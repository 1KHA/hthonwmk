import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from "@/lib/prisma";
import { getSignedUploadUrl } from '@/lib/supabase-storage';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JwtPayload {
  participantId: string;
  email: string;
  role: string;
  teamId?: string;
  isLeader?: boolean;
}

// Error types for better error handling
enum ErrorType {
  VALIDATION = 'validation_error',
  AUTHENTICATION = 'authentication_error',
  AUTHORIZATION = 'authorization_error',
  NOT_FOUND = 'not_found_error',
  DUPLICATE = 'duplicate_error',
  UPLOAD = 'upload_error',
  DATABASE = 'database_error',
  TIMEOUT = 'timeout_error',
  UNKNOWN = 'unknown_error'
}

// Helper function to log and return errors
function handleError(error: any, message: string, status: number, type: ErrorType) {
  console.error(`[${type}] ${message}:`, error);
  return NextResponse.json(
    { 
      error: message,
      errorType: type
    },
    { status }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json();
    const { milestoneId, fileName, fileType } = body;

    // Validate inputs
    if (!milestoneId) {
      return handleError(
        null,
        "معرف المرحلة مطلوب",
        400,
        ErrorType.VALIDATION
      );
    }

    if (!fileName) {
      return handleError(
        null,
        "اسم الملف مطلوب",
        400,
        ErrorType.VALIDATION
      );
    }

    // Get the participant ID from the JWT token
    const cookieStore = cookies();
    const tokenCookie = cookieStore.get('token');

    if (!tokenCookie) {
      console.log('No token cookie found in request');
      return handleError(
        null,
        "يرجى تسجيل الدخول للتسليم",
        401,
        ErrorType.AUTHENTICATION
      );
    }

    const token = tokenCookie.value;
    let decoded: JwtPayload;

    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (err) {
      return handleError(
        err,
        "جلسة غير صالحة، يرجى تسجيل الدخول مرة أخرى",
        401,
        ErrorType.AUTHENTICATION
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
      return handleError(
        null,
        "لم يتم العثور على المشارك",
        404,
        ErrorType.NOT_FOUND
      );
    }

    // Check if the participant is a team leader
    if (!participant.isLeader) {
      return handleError(
        null,
        "فقط قائد الفريق يمكنه تسليم المشاريع",
        403,
        ErrorType.AUTHORIZATION
      );
    }

    // Check if the milestone exists
    const milestone = await prisma.$queryRaw`
      SELECT * FROM "Milestone" WHERE id = ${milestoneId}
    `;
    
    // Type assertion for milestone
    const milestoneArray = milestone as any[];
    
    if (!milestoneArray || milestoneArray.length === 0) {
      return handleError(
        null,
        "لم يتم العثور على المرحلة",
        404,
        ErrorType.NOT_FOUND
      );
    }

    // Check if the participant has already submitted for this milestone
    const existingSubmission = await prisma.$queryRaw`
      SELECT * FROM "MilestoneSubmission" 
      WHERE "participantId" = ${participant.id} AND "milestoneId" = ${milestoneId}
    `;
    
    // Type assertion for existingSubmission
    const existingSubmissionArray = existingSubmission as any[];
    
    if (existingSubmissionArray && existingSubmissionArray.length > 0) {
      return handleError(
        null,
        "لقد قمت بتسليم هذا المشروع بالفعل ولا يمكنك التسليم مرة أخرى",
        400,
        ErrorType.DUPLICATE
      );
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const uniqueFileName = `${timestamp}_${fileName}`;
    const folderPath = 'milestones';
    
    // Get signed URL for direct upload
    const signedUrlData = await getSignedUploadUrl(uniqueFileName, folderPath);
    
    return NextResponse.json({
      success: true,
      signedUrl: signedUrlData.signedUrl,
      publicUrl: signedUrlData.publicUrl,
      path: signedUrlData.path,
      participantId: participant.id,
      milestoneId,
      fileName
    });
  } catch (error: any) {
    // Generic error handler
    return handleError(
      error,
      "حدث خطأ غير متوقع أثناء إنشاء رابط الرفع. يرجى المحاولة مرة أخرى.",
      500,
      ErrorType.UNKNOWN
    );
  }
}
