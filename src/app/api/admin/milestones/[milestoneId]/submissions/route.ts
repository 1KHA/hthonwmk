import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/admin/milestones/[milestoneId]/submissions
// Fetches all submissions for a specific milestone
export async function GET(
  request: NextRequest,
  { params }: { params: { milestoneId: string } }
) {
  try {
    // Check if admin is authenticated (this would be implemented with proper auth)
    // For now, we'll skip this check for development purposes

    const { milestoneId } = params;

    if (!milestoneId) {
      return NextResponse.json(
        { error: "معرف المرحلة مطلوب" },
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

    // Fetch all submissions for this milestone with participant and team info
    const submissions = await prisma.$queryRaw`
      SELECT 
        ms.id, 
        ms."participantId", 
        ms."milestoneId", 
        ms."filePath", 
        ms."fileName", 
        ms."submittedAt", 
        ms."reviewStatus", 
        ms."reviewComment", 
        ms."reviewedAt",
        p."firstName", 
        p."secondName", 
        p."familyName", 
        p.email,
        t.id as teamId, 
        t."teamName"
      FROM "MilestoneSubmission" ms
      JOIN "Participant" p ON ms."participantId" = p.id
      JOIN "Team" t ON p."teamId" = t.id
      WHERE ms."milestoneId" = ${milestoneId}
      ORDER BY ms."submittedAt" DESC
    `;

    // Transform the raw data to a more structured format
    const formattedSubmissions = Array.isArray(submissions) ? submissions.map(sub => ({
      id: sub.id,
      participantId: sub.participantId,
      milestoneId: sub.milestoneId,
      filePath: sub.filePath,
      fileName: sub.fileName,
      submittedAt: sub.submittedAt,
      reviewStatus: sub.reviewStatus,
      reviewComment: sub.reviewComment,
      reviewedAt: sub.reviewedAt,
      participant: {
        id: sub.participantId,
        firstName: sub.firstName,
        secondName: sub.secondName,
        familyName: sub.familyName,
        email: sub.email,
        teamId: sub.teamId,
        team: {
          id: sub.teamId,
          teamName: sub.teamName
        }
      }
    })) : [];

    return NextResponse.json(formattedSubmissions);
  } catch (error) {
    console.error("Error fetching milestone submissions:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب التسليمات" },
      { status: 500 }
    );
  }
}
