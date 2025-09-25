import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { createNotification, notifyAllAdmins, NotificationTemplates } from '@/lib/notifications'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Get the auth token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value || cookieStore.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized: No token provided" }, { status: 401 });
    }

    // Verify the token and check if it's an admin
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!) as { id?: string, adminId?: string, role?: string };
    } catch (error) {
      return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
    }

    // Check if it's an admin token (could be in adminId or role field)
    if (!decodedToken || (!decodedToken.adminId && decodedToken.role !== 'admin')) {
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 401 });
    }

    // Parse participant data from request
    const participantData = await request.json();
    
    // Basic validation
    if (!participantData.email || !participantData.fullName) {
      return NextResponse.json({ error: 'Required participant fields are missing.' }, { status: 400 })
    }

    // Check if email already exists
    const existingParticipant = await prisma.participant.findUnique({
      where: { email: participantData.email.toLowerCase() }
    });

    if (existingParticipant) {
      return NextResponse.json(
        { error: 'A participant with this email already exists.' },
        { status: 400 }
      )
    }

    // Create the participant with pending status
    const participant = await prisma.participant.create({
      data: {
        // Use NEW CSV-based fields (primary)
        fullName: participantData.fullName || '',
        contactNumber: participantData.contactNumber || '',
        email: participantData.email.toLowerCase(),
        gender: participantData.gender || '',
        isUniversityStudent: participantData.isUniversityStudent || false,
        universityMajor: participantData.universityMajor || '',
        university: participantData.university || '',
        professionalField: participantData.professionalField || '',
        city: participantData.city || '',
        canAttendHackathon: participantData.canAttendHackathon || false,
        isLeader: false,
        status: 'pending',
        // Keep deprecated fields for backward compatibility
        firstName: participantData.fullName || '',
        secondName: '',
        familyName: '',
        nationalId: '',
        dob: '',
        phoneNumber: participantData.contactNumber || '',
        education: participantData.universityMajor || '',
        major: participantData.universityMajor || '',
        employmentStatus: participantData.professionalField || '',
        nationality: participantData.gender || '',
        residence: participantData.city || '',
        canAttend: participantData.canAttendHackathon || false,
      },
    });

    // Create notification for admins about new participant
    try {
      // Use a direct notification since there's no specific template for individual participants
      await notifyAllAdmins(
        "مشارك جديد تمت إضافته",
        `تم إضافة مشارك جديد: ${participantData.fullName} بواسطة المشرف`,
        "info",
        {
          relatedEntityType: 'participant',
          relatedEntityId: participant.id,
          actionUrl: "/admin-hackton-dashboard/participants",
        }
      );
    } catch (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Don't fail the registration if notification fails
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Participant created successfully',
        participant: participant,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating participant:', error)
    return NextResponse.json(
      { error: 'Failed to create participant' },
      { status: 500 }
    )
  }
}
