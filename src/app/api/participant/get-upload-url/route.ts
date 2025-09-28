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

// Since direct client-side uploads aren't available in this version of @vercel/blob,
// we'll use a two-step process:
// 1. First API call to validate the file and check permissions
// 2. Second API call to actually upload the file (smaller chunks if needed)

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

    // Return validation success and file details
    // The actual upload will happen in a separate API call with chunked uploads
    return NextResponse.json({
      success: true,
      validationPassed: true,
      fileName: uniqueFileName,
      originalFileName: fileName,
      milestoneId,
      submissionId,
      participantId: participant.id,
      teamName: participant.team?.teamName || 'فريق غير محدد',
      maxChunkSize: 4 * 1024 * 1024, // 4MB chunks to stay under Vercel's payload limit
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
