import type { Metadata } from "next";
import { DeleteAccountPage } from "@/components/DeleteAccountPage";

export const metadata: Metadata = {
  title: "刪除帳號 · 記帳本",
  description: "刪除記帳本的雲端帳號，以及這個帳號在雲端和這台裝置上的帳目。",
};

export default function Page() {
  return <DeleteAccountPage />;
}
