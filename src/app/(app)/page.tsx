import { redirect } from "next/navigation";

// BuildAtScaleOS opens on the Ops Tracker module; /ops picks the user's first screen.
export default function HomePage() {
  redirect("/ops");
}
