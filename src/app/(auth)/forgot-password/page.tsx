import SignIn from "@/components/SignIn";

export const metadata = {
  title: "Reset Password — eBookMine",
  description: "Reset your eBookMine password with OTP email verification.",
};

export default function ForgotPasswordPage() {
  return <SignIn initialTab="forgot" />;
}
