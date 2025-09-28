import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

// GET /api/admin/submissions
// Fetches all submissions across all milestones
export async function GET(request: NextRequest) {
  try {
    // Check if admin is authenticated (this would be implemented with proper auth)
    // For now, we'll skip this check for development purposes

    // Fetch all submissions with participant, team, and milestone info
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
        t."teamName",
        m.title as milestoneTitle,
        m."dueDate" as milestoneDueDate
      FROM "MilestoneSubmission" ms
      JOIN "Participant" p ON ms."participantId" = p.id
      JOIN "Team" t ON p."teamId" = t.id
      JOIN "Milestone" m ON ms."milestoneId" = m.id
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
      },
      milestone: {
        id: sub.milestoneId,
        title: sub.milestoneTitle,
        dueDate: sub.milestoneDueDate
      }
    })) : [];

    return NextResponse.json(formattedSubmissions);
  } catch (error) {
    console.error("Error fetching all submissions:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء جلب التسليمات" },
      { status: 500 }
    );
  }
}
