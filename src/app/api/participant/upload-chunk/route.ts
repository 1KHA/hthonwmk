import { NextRequest, NextResponse } from "next/server";
import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from "@/lib/prisma";
import { notifyAllAdmins, NotificationTemplates } from '@/lib/notifications';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JwtPayload {
  participantId: string;
  email: string;
  role: string;
  teamId?: string;
  isLeader?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const cookieStore = cookies();
    const tokenCookie = cookieStore.get('token');

    if (!tokenCookie) {
      console.log('No token cookie found in request');
      return NextResponse.json(
        { error: "يرجى تسجيل الدخول للتسليم" },
        { status: 401 }
      );
    }

    const token = tokenCookie.value;
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (err) {
      console.error('Token verification failed:', err);
      return NextResponse.json(
        { error: "جلسة غير صالحة، يرجى تسجيل الدخول مرة أخرى" },
        { status: 401 }
      );
    }

    // Get the form data
    const formData = await request.formData();
    
    // Get chunk information
    const chunk = formData.get("chunk") as File;
    const chunkIndex = parseInt(formData.get("chunkIndex") as string);
    const totalChunks = parseInt(formData.get("totalChunks") as string);
    const fileName = formData.get("fileName") as string;
    const originalFileName = formData.get("originalFileName") as string;
    const milestoneId = formData.get("milestoneId") as string;
    const submissionId = formData.get("submissionId") as string;
    const path = formData.get("path") as string;
    
    // Validate inputs
    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !fileName || !milestoneId || !submissionId || !path) {
      return NextResponse.json(
        { error: "جميع الحقول مطلوبة" },
        { status: 400 }
      );
    }

    // For the first chunk, we'll create a new file
    // For subsequent chunks, we'll need to append to the existing file
    // However, Vercel Blob doesn't support appending to files directly
    // So we'll upload each chunk with a unique name and then combine them later
    
    const chunkPath = `${path}.part${chunkIndex}`;
    
    console.log(`Uploading chunk ${chunkIndex + 1}/${totalChunks} for ${fileName}`);
    
    // Upload the chunk to Vercel Blob
    const { url } = await put(chunkPath, chunk, {
      access: 'public',
    });
    
    // If this is the last chunk, we need to create the database record
    if (chunkIndex === totalChunks - 1) {
      console.log(`All chunks uploaded for ${fileName}. Creating database record.`);
      
      // Get the participant ID from the token
      const participantId = decoded.participantId;
      
      // Get the participant with team information
      const participant = await prisma.participant.findUnique({
        where: { id: participantId },
        include: { team: true },
      });
      
      if (!participant) {
        return NextResponse.json(
          { error: "لم يتم العثور على المشارك" },
          { status: 404 }
        );
      }
      
      // Check if the milestone exists
      const milestone = await prisma.$queryRaw`
        SELECT * FROM "Milestone" WHERE id = ${milestoneId}
      `;
      
      if (!milestone || (Array.isArray(milestone) && milestone.length === 0)) {
        return NextResponse.json(
          { error: "لم يتم العثور على المرحلة" },
          { status: 404 }
        );
      }
      
      // Create a new milestone submission in the database
      try {
        await prisma.$executeRaw`
          INSERT INTO "MilestoneSubmission" (id, "participantId", "milestoneId", "filePath", "fileName", "submittedAt")
          VALUES (${submissionId}, ${participant.id}, ${milestoneId}, ${url}, ${originalFileName}, ${new Date().toISOString()}::timestamp)
        `;

        // Update the milestone submission count
        await prisma.$executeRaw`
          UPDATE "Milestone"
          SET "submissionCount" = "submissionCount" + 1
          WHERE id = ${milestoneId}
        `;
        
        console.log(`Database records created successfully for submission by participant ${participantId}`);
        
        // Create notification for admins about new milestone submission
        try {
          const milestoneData = Array.isArray(milestone) ? milestone[0] : milestone;
          const template = NotificationTemplates.newMilestoneSubmission(
            participant.team?.teamName || 'فريق غير محدد',
            milestoneData?.title || 'مرحلة غير محددة'
          );
          await notifyAllAdmins(
            template.title,
            template.message,
            template.type,
            {
              relatedEntityType: 'milestone',
              relatedEntityId: milestoneId,
              actionUrl: template.actionUrl,
            }
          );
        } catch (notificationError) {
          console.error('Error creating milestone submission notification:', notificationError);
          // Don't fail the submission if notification fails
        }
      } catch (dbError) {
        console.error("Error creating database record:", dbError);
        return NextResponse.json(
          { error: "حدث خطأ أثناء حفظ بيانات التسليم في قاعدة البيانات" },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        success: true,
        message: "تم تسليم المشروع بنجاح",
        isComplete: true,
        url
      });
    }
    
    // For intermediate chunks, just return success
    return NextResponse.json({
      success: true,
      chunkIndex,
      totalChunks,
      isComplete: false,
      message: `تم رفع الجزء ${chunkIndex + 1} من ${totalChunks}`
    });
  } catch (error) {
    console.error("Error uploading chunk:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء رفع الملف" },
      { status: 500 }
    );
  }
}
