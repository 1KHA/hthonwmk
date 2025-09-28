import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { notifyAllAdmins, NotificationTemplates } from '@/lib/notifications';
import { uploadToBlob } from '@/lib/blob-storage';
import { MAX_FILE_SIZE, MAX_FILE_SIZE_MB, ALLOWED_FILE_TYPES } from '@/lib/constants';

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
  const startTime = Date.now();
  let uploadStartTime = 0;
  let uploadEndTime = 0;
  
  try {
    // Check if the request is multipart/form-data
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return handleError(
        null,
        "يجب أن يكون الطلب من نوع multipart/form-data",
        400,
        ErrorType.VALIDATION
      );
    }

    // Get the form data
    const formData = await request.formData();
    const milestoneId = formData.get("milestoneId") as string;
    const file = formData.get("file") as File;

    // Validate inputs
    if (!milestoneId) {
      return handleError(
        null,
        "معرف المرحلة مطلوب",
        400,
        ErrorType.VALIDATION
      );
    }

    if (!file) {
      return handleError(
        null,
        "الملف مطلوب",
        400,
        ErrorType.VALIDATION
      );
    }

    // Log file information for debugging
    console.log(`File upload attempt: ${file.name}, size: ${(file.size / (1024 * 1024)).toFixed(2)}MB, type: ${file.type}`);

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return handleError(
        null,
        `حجم الملف (${(file.size / (1024 * 1024)).toFixed(2)} ميجابايت) يتجاوز الحد الأقصى المسموح به (${MAX_FILE_SIZE_MB} ميجابايت)`,
        400,
        ErrorType.VALIDATION
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(file.type) && file.type !== "") {
      return handleError(
        null,
        `نوع الملف (${file.type}) غير مدعوم. الأنواع المدعومة: PDF, Word, ZIP, RAR, JPEG, PNG`,
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
    if (!milestone || (Array.isArray(milestone) && milestone.length === 0)) {
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
    
    if (existingSubmission && Array.isArray(existingSubmission) && existingSubmission.length > 0) {
      return handleError(
        null,
        "لقد قمت بتسليم هذا المشروع بالفعل ولا يمكنك التسليم مرة أخرى",
        400,
        ErrorType.DUPLICATE
      );
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const originalName = file.name;
    const fileName = `${timestamp}_${originalName}`;
    
    // Upload file to blob storage with timeout handling
    console.log(`Starting file upload to Vercel Blob: ${fileName}`);
    uploadStartTime = Date.now();
    
    let filePath: string;
    try {
      // Set a timeout for the upload operation
      const uploadPromise = uploadToBlob(file, fileName, 'milestones');
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout')), 280000); // 4 minutes 40 seconds
      });
      
      // Race between upload and timeout
      filePath = await Promise.race([uploadPromise, timeoutPromise]);
      
      uploadEndTime = Date.now();
      console.log(`File upload completed in ${(uploadEndTime - uploadStartTime) / 1000} seconds. URL: ${filePath}`);
    } catch (uploadError: any) {
      if (uploadError.message === 'Upload timeout') {
        return handleError(
          uploadError,
          "انتهت مهلة رفع الملف. قد يكون حجم الملف كبيرًا جدًا أو اتصال الإنترنت بطيء.",
          408,
          ErrorType.TIMEOUT
        );
      }
      
      // Check for specific Vercel Blob errors
      if (uploadError.name === 'BlobError') {
        return handleError(
          uploadError,
          "حدث خطأ أثناء رفع الملف إلى التخزين السحابي. يرجى المحاولة مرة أخرى.",
          500,
          ErrorType.UPLOAD
        );
      }
      
      return handleError(
        uploadError,
        "فشل رفع الملف. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.",
        500,
        ErrorType.UPLOAD
      );
    }

    // Create a new milestone submission in the database
    try {
      const submission = await prisma.$executeRaw`
        INSERT INTO "MilestoneSubmission" (id, "participantId", "milestoneId", "filePath", "fileName", "submittedAt")
        VALUES (${crypto.randomUUID()}, ${participant.id}, ${milestoneId}, ${filePath}, ${originalName}, ${new Date().toISOString()}::timestamp)
      `;

      // Update the milestone submission count
      await prisma.$executeRaw`
        UPDATE "Milestone"
        SET "submissionCount" = "submissionCount" + 1
        WHERE id = ${milestoneId}
      `;
      
      console.log(`Database records created successfully for submission by participant ${participantId}`);
    } catch (dbError) {
      return handleError(
        dbError,
        "حدث خطأ أثناء حفظ بيانات التسليم في قاعدة البيانات",
        500,
        ErrorType.DATABASE
      );
    }

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

    const totalTime = Date.now() - startTime;
    console.log(`Total submission process completed in ${totalTime / 1000} seconds`);

    return NextResponse.json({
      success: true,
      message: "تم تسليم المشروع بنجاح",
      fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} ميجابايت`,
      uploadTime: `${(uploadEndTime - uploadStartTime) / 1000} ثانية`,
      totalTime: `${totalTime / 1000} ثانية`
    });
  } catch (error: any) {
    // Check for timeout errors
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      return handleError(
        error,
        "انتهت مهلة العملية. قد يكون حجم الملف كبيرًا جدًا أو اتصال الإنترنت بطيء.",
        408,
        ErrorType.TIMEOUT
      );
    }
    
    // Check for network errors
    if (error.name === 'NetworkError' || error.message?.includes('network')) {
      return handleError(
        error,
        "حدث خطأ في الاتصال بالشبكة. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.",
        503,
        ErrorType.UPLOAD
      );
    }
    
    // Generic error handler
    return handleError(
      error,
      "حدث خطأ غير متوقع أثناء تسليم المشروع. يرجى المحاولة مرة أخرى.",
      500,
      ErrorType.UNKNOWN
    );
  }
}
