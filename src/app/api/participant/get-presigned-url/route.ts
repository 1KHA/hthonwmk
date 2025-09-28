import { NextRequest, NextResponse } from "next/server";
import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES } from '@/lib/constants';

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

    // Get participantId directly from the decoded token
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

    // Check if the participant is a team leader
    if (!participant.isLeader) {
      console.log(`Participant ${participantId} is not a team leader. isLeader=${participant.isLeader}`);
      return NextResponse.json(
        { error: "فقط قائد الفريق يمكنه تسليم المشاريع" },
        { status: 403 }
      );
    }

    // Get the request body
    const body = await request.json();
    const { fileName, fileType, fileSize, milestoneId } = body;

    // Validate inputs
    if (!fileName || !fileType || !fileSize || !milestoneId) {
      return NextResponse.json(
        { error: "جميع الحقول مطلوبة: اسم الملف، نوع الملف، حجم الملف، معرف المرحلة" },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `حجم الملف (${(fileSize / (1024 * 1024)).toFixed(2)} ميجابايت) يتجاوز الحد الأقصى المسموح به (${MAX_FILE_SIZE_MB} ميجابايت)` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(fileType) && fileType !== "") {
      return NextResponse.json(
        { error: `نوع الملف (${fileType}) غير مدعوم. الأنواع المدعومة: PDF, Word, ZIP, RAR, JPEG, PNG` },
        { status: 400 }
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

    // Check if the participant has already submitted for this milestone
    const existingSubmission = await prisma.$queryRaw`
      SELECT * FROM "MilestoneSubmission" 
      WHERE "participantId" = ${participant.id} AND "milestoneId" = ${milestoneId}
    `;
    
    if (existingSubmission && Array.isArray(existingSubmission) && existingSubmission.length > 0) {
      return NextResponse.json(
        { error: "لقد قمت بتسليم هذا المشروع بالفعل ولا يمكنك التسليم مرة أخرى" },
        { status: 400 }
      );
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}_${fileName}`;
    const folderPath = 'milestones';
    const path = `${folderPath}/${uniqueFileName}`;
    
    // Generate a unique submission ID
    const submissionId = crypto.randomUUID();

    // Since direct client-side uploads aren't available in this version of @vercel/blob,
    // we'll use a workaround with a third-party service like AWS S3 or Firebase Storage
    // For now, we'll return validation success and file details
    return NextResponse.json({
      success: true,
      validationPassed: true,
      fileName: uniqueFileName,
      originalFileName: fileName,
      milestoneId,
      submissionId,
      participantId: participant.id,
      teamName: participant.team?.teamName || 'فريق غير محدد',
      // We'll use a third-party service for direct uploads
      // For now, we'll use a small file size limit for the submit-milestone endpoint
      maxFileSize: 4 * 1024 * 1024, // 4MB to stay under Vercel's payload limit
      path
    });
  } catch (error) {
    console.error("Error validating submission:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء التحقق من صحة الملف" },
      { status: 500 }
    );
  }
}
