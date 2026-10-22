import { GymClassesScreen } from "@/components/gyms/GymClassesScreen";

export default async function GymClassesPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params;
  return <GymClassesScreen gymId={gymId} />;
}
