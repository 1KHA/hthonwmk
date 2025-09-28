import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/../../components/ui/dialog";
import { Button } from "@/../../components/ui/button";
import { Input } from "@/../../components/ui/input";
import { Label } from "@/../../components/ui/label";
import { Textarea } from "@/../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/../../components/ui/select";
import { Checkbox } from "@/../../components/ui/checkbox";
import { Search, UserPlus, Users, Check } from "lucide-react";
import { useToast } from "@/../../components/ui/use-toast";

interface Participant {
  id: string;
  email: string;
  fullName?: string;
  firstName?: string;
  secondName?: string;
  familyName?: string;
  university?: string;
  major?: string;
  city?: string;
  gender?: string;
}

interface AutoTeamCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AutoTeamCreationModal({
  isOpen,
  onClose,
  onSuccess,
}: AutoTeamCreationModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState<string>("");
  const [teamName, setTeamName] = useState("");
  const [hackathonTrack, setHackathonTrack] = useState("");
  const [ideaDescription, setIdeaDescription] = useState("");
  const [step, setStep] = useState(1);
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [universityFilter, setUniversityFilter] = useState<string>("all");

  // Fetch individual participants
  useEffect(() => {
    if (isOpen) {
      fetchParticipants();
    }
  }, [isOpen]);

  // Apply filters and search
  useEffect(() => {
    let filtered = [...participants];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => {
        const fullName = p.fullName || `${p.firstName || ''} ${p.secondName || ''} ${p.familyName || ''}`.trim();
        return fullName.toLowerCase().includes(query) || 
               p.email.toLowerCase().includes(query) ||
               (p.university && p.university.toLowerCase().includes(query)) ||
               (p.major && p.major.toLowerCase().includes(query));
      });
    }
    
    // Apply gender filter
    if (genderFilter !== "all") {
      filtered = filtered.filter(p => p.gender === genderFilter);
    }
    
    // Apply university filter
    if (universityFilter !== "all") {
      filtered = filtered.filter(p => p.university === universityFilter);
    }
    
    setFilteredParticipants(filtered);
  }, [participants, searchQuery, genderFilter, universityFilter]);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/participants");
      if (response.ok) {
        const data = await response.json();
        setParticipants(data);
        setFilteredParticipants(data);
      } else {
        toast({
          title: "خطأ",
          description: "فشل في جلب المشاركين",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching participants:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء جلب المشاركين",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleParticipant = (participantId: string) => {
    setSelectedParticipants(prev => {
      if (prev.includes(participantId)) {
        // If removing the leader, reset leader ID
        if (leaderId === participantId) {
          setLeaderId("");
        }
        return prev.filter(id => id !== participantId);
      } else {
        return [...prev, participantId];
      }
    });
  };

  const handleSelectLeader = (participantId: string) => {
    // Ensure the leader is also selected as a team member
    if (!selectedParticipants.includes(participantId)) {
      setSelectedParticipants(prev => [...prev, participantId]);
    }
    setLeaderId(participantId);
  };

  const getDisplayName = (participant: Participant) => {
    return participant.fullName || 
           `${participant.firstName || ''} ${participant.secondName || ''} ${participant.familyName || ''}`.trim() || 
           'غير متوفر';
  };

  const handleNextStep = () => {
    if (step === 1) {
      if (selectedParticipants.length < 2) {
        toast({
          title: "تنبيه",
          description: "يجب اختيار مشاركين اثنين على الأقل",
          variant: "destructive",
        });
        return;
      }
      
      if (!leaderId) {
        toast({
          title: "تنبيه",
          description: "يجب اختيار قائد للفريق",
          variant: "destructive",
        });
        return;
      }
      
      setStep(2);
    } else {
      handleCreateTeam();
    }
  };

  const handlePreviousStep = () => {
    setStep(1);
  };

  const handleCreateTeam = async () => {
    if (!teamName || !hackathonTrack) {
      toast({
        title: "تنبيه",
        description: "يجب إدخال اسم الفريق والمسار",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/admin/auto-create-teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamName,
          hackathonTrack,
          ideaDescription,
          participantIds: selectedParticipants,
          leaderId,
        }),
      });

      if (response.ok) {
        toast({
          title: "نجح",
          description: "تم إنشاء الفريق بنجاح",
        });
        onSuccess();
        resetForm();
        onClose();
      } else {
        const data = await response.json();
        toast({
          title: "خطأ",
          description: data.error || "فشل في إنشاء الفريق",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating team:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إنشاء الفريق",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedParticipants([]);
    setLeaderId("");
    setTeamName("");
    setHackathonTrack("");
    setIdeaDescription("");
    setStep(1);
    setSearchQuery("");
    setGenderFilter("all");
    setUniversityFilter("all");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Get unique universities for filter
  const universities = React.useMemo(() => {
    const uniqueUniversities = new Set<string>();
    participants.forEach(p => {
      if (p.university) {
        uniqueUniversities.add(p.university);
      }
    });
    return Array.from(uniqueUniversities).sort();
  }, [participants]);

  // Static list of Arabic tracks
  const ARABIC_TRACKS = [
    "تحديات البنية التحتية الذكية",
    " تحديات بيئية",
    "تحديات إدارة الحشود",
    " تحديات صحية",
  ];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إنشاء فريق جديد من المشاركين الأفراد</DialogTitle>
          <DialogDescription>
            {step === 1 
              ? "اختر المشاركين وقائد الفريق" 
              : "أدخل معلومات الفريق"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <>
            <div className="flex flex-col md:flex-row justify-between mb-4 gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <input
                  type="text"
                  placeholder="البحث عن مشاركين..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-2 pr-10 pl-4 rounded-md border border-input bg-background text-right"
                />
              </div>
              <div className="flex gap-2">
                <Select value={genderFilter} onValueChange={setGenderFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="الجنس" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={universityFilter} onValueChange={setUniversityFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="الجامعة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الجامعات</SelectItem>
                    {universities.map(uni => (
                      <SelectItem key={uni} value={uni}>{uni}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border rounded-md p-2 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">
                  المشاركون المختارون: {selectedParticipants.length}
                </span>
                <span className="text-sm text-muted-foreground">
                  قائد الفريق: {leaderId ? getDisplayName(participants.find(p => p.id === leaderId)!) : "لم يتم الاختيار"}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted">
                    <th className="border p-2 text-right">اختيار</th>
                    <th className="border p-2 text-right">الاسم</th>
                    <th className="border p-2 text-right">البريد الإلكتروني</th>
                    <th className="border p-2 text-right">الجامعة</th>
                    <th className="border p-2 text-right">التخصص</th>
                    <th className="border p-2 text-right">المدينة</th>
                    <th className="border p-2 text-right">قائد الفريق</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center p-4">جاري التحميل...</td>
                    </tr>
                  ) : filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-4">لا يوجد مشاركين متاحين</td>
                    </tr>
                  ) : (
                    filteredParticipants.map((participant) => (
                      <tr key={participant.id} className={`hover:bg-muted/50 ${selectedParticipants.includes(participant.id) ? 'bg-blue-50' : ''}`}>
                        <td className="border p-2 text-center">
                          <Checkbox
                            checked={selectedParticipants.includes(participant.id)}
                            onCheckedChange={() => handleToggleParticipant(participant.id)}
                          />
                        </td>
                        <td className="border p-2">{getDisplayName(participant)}</td>
                        <td className="border p-2">{participant.email}</td>
                        <td className="border p-2">{participant.university || 'غير متوفر'}</td>
                        <td className="border p-2">{participant.major || 'غير متوفر'}</td>
                        <td className="border p-2">{participant.city || 'غير متوفر'}</td>
                        <td className="border p-2 text-center">
                          <button
                            className={`p-1 rounded-full ${leaderId === participant.id ? 'bg-blue-100 text-blue-800' : 'hover:bg-muted'}`}
                            onClick={() => handleSelectLeader(participant.id)}
                            disabled={!selectedParticipants.includes(participant.id) && leaderId !== participant.id}
                            title="تعيين كقائد للفريق"
                          >
                            {leaderId === participant.id ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <UserPlus className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="team-name">اسم الفريق</Label>
              <Input
                id="team-name"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="أدخل اسم الفريق"
                className="text-right"
              />
            </div>

            <div>
              <Label htmlFor="hackathon-track">المسار</Label>
              <Select value={hackathonTrack} onValueChange={setHackathonTrack}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المسار" />
                </SelectTrigger>
                <SelectContent>
                  {ARABIC_TRACKS.map((track) => (
                    <SelectItem key={track} value={track}>
                      {track}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="idea-description">وصف الفكرة</Label>
              <Textarea
                id="idea-description"
                value={ideaDescription}
                onChange={(e) => setIdeaDescription(e.target.value)}
                placeholder="أدخل وصفاً للفكرة (اختياري)"
                className="text-right"
              />
            </div>

            <div className="p-4 border rounded-md bg-muted/20">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <Users className="h-5 w-5" />
                أعضاء الفريق ({selectedParticipants.length})
              </h3>
              <ul className="space-y-2">
                {selectedParticipants.map(id => {
                  const participant = participants.find(p => p.id === id);
                  if (!participant) return null;
                  return (
                    <li key={id} className="flex justify-between items-center p-2 border-b">
                      <span>{getDisplayName(participant)}</span>
                      {id === leaderId && (
                        <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          قائد الفريق
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                إلغاء
              </Button>
              <Button onClick={handleNextStep} disabled={loading || selectedParticipants.length < 2 || !leaderId}>
                التالي
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handlePreviousStep}>
                السابق
              </Button>
              <Button onClick={handleNextStep} disabled={loading || !teamName || !hackathonTrack}>
                {loading ? "جاري الإنشاء..." : "إنشاء الفريق"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
