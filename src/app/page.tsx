import App from "@/components/app";
import { AccountProvider } from '@/components/account';
export default function Page() {
  return <AccountProvider><App /></AccountProvider>;
}
