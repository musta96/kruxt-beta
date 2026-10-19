import { GymClassesScreen } from "@/components/gyms/GymClassesScreen";

export default function GymClassesPage({ params }: { params: { gymId: string } }) {
  return <GymClassesScreen gymId={params.gymId} />;
}
