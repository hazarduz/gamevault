import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import GamePicker from "@/components/GamePicker";

export const dynamic = "force-dynamic";

export default async function GamePickerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-parchment">Game Picker</h1>
      <p className="mt-1 text-sm text-mute">
        A random game you could play — one you don&rsquo;t own, or one you own and
        haven&rsquo;t started. Hit re-pick until something grabs you.
      </p>
      <GamePicker />
    </div>
  );
}
