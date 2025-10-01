import { NextRequest, NextResponse } from "next/server";
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from "@/lib/prisma";
import { MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '@/lib/constants';
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
    // Parse the request body as JSON (not multipart/form-data)
    const body = await request.json();
    const { milestoneId, fileName, fileType, fileSize } = body;

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

    // Log file information for debugging
    console.log(`File upload request: ${fileName}, size: ${fileSize ? (fileSize / (1024 * 1024)).toFixed(2) + 'MB' : 'unknown'}, type: ${fileType || 'unknown'}`);

    // Validate file size if provided
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return handleError(
        null,
        `حجم الملف (${(fileSize / (1024 * 1024)).toFixed(2)} ميجابايت) يتجاوز الحد الأقصى المسموح به (${MAX_FILE_SIZE / (1024 * 1024)} ميجابايت).`,
        400,
        ErrorType.VALIDATION
      );
    }

    // Validate file type if provided
    if (fileType && !ALLOWED_FILE_TYPES.includes(fileType) && fileType !== "") {
      return handleError(
        null,
        `نوع الملف (${fileType}) غير مدعوم. الأنواع المدعومة: PDF, Word, PPTX, ZIP, RAR, JPEG, PNG`,
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

    // Generate a unique filename with sanitized name
    const timestamp = Date.now();
    // Sanitize filename by removing/replacing problematic characters
    const sanitizedFileName = fileName
      .replace(/[^\w\s.-]/g, '') // Remove non-alphanumeric characters except spaces, dots, and hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single underscore
      .trim();
    
    // If sanitization results in empty filename, use a default
    const finalFileName = sanitizedFileName || 'file';
    const uniqueFileName = `${timestamp}_${finalFileName}`;
    const folderPath = 'milestones';
    
    // Generate signed URL for direct upload to Supabase
    console.log(`Generating signed URL for file: ${uniqueFileName}`);
    
    try {
      const signedUrlData = await getSignedUploadUrl(uniqueFileName, folderPath);
      
      console.log(`Signed URL generated successfully for participant ${participantId}`);

      return NextResponse.json({
        success: true,
        message: "تم إنشاء رابط الرفع بنجاح",
        signedUrl: signedUrlData.signedUrl,
        publicUrl: signedUrlData.publicUrl,
        path: signedUrlData.path,
        participantId: participant.id,
        milestoneId,
        fileName,
        instructions: {
          step1: "استخدم الرابط المُوقع لرفع الملف مباشرة إلى التخزين",
          step2: "بعد الرفع الناجح، استدعي /api/participant/record-submission لتسجيل التسليم",
          uploadMethod: "PUT",
          contentType: fileType || "application/octet-stream"
        }
      });
    } catch (uploadError: any) {
      return handleError(
        uploadError,
        "فشل إنشاء رابط الرفع. يرجى المحاولة مرة أخرى.",
        500,
        ErrorType.UPLOAD
      );
    }
  } catch (error: any) {
    // Generic error handler
    return handleError(
      error,
      "حدث خطأ غير متوقع أثناء معالجة طلب التسليم. يرجى المحاولة مرة أخرى.",
      500,
      ErrorType.UNKNOWN
    );
  }
}
