import SignIn from "@/components/SignIn";

export const metadata = {
  title: "Sign Up — eBookMine",
  description: "Create an account with OTP email verification.",
};

export default function RegisterPage() {
  return <SignIn initialTab="signup" />;
}
