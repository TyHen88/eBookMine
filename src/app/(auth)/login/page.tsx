import SignIn from "@/components/SignIn";

export const metadata = {
  title: "Sign In — eBookMine",
  description: "Sign in to your eBookMine account.",
};

export default function LoginPage() {
  return <SignIn initialTab="signin" />;
}
