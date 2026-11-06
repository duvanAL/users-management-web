import Login from "@/components/login-form";

// Read at request time: the same container image serves Dev and cloud safely.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const demoAccounts =
    process.env.WEB_DEMO_ACCESS === "true"
      ? [
          {
            role: "Administrador",
            email: "admin@dev.local",
            password: "DevAdmin123!",
          },
          {
            role: "Revisor",
            email: "auditor@dev.local",
            password: "DevReview123!",
          },
          {
            role: "Miembro",
            email: "usuario@dev.local",
            password: "DevMember123!",
          },
        ]
      : [];
  return <Login demoAccounts={demoAccounts} />;
}
