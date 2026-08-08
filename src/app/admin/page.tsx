import { redirect } from "next/navigation";

import { isAdminAuthenticated } from "@/lib/auth/guards";

export default async function AdminIndexPage() {
  redirect((await isAdminAuthenticated()) ? "/admin/motoristas" : "/admin/login");
}
