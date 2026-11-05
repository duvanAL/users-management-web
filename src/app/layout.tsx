import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Gestión · Espacio de trabajo",
    template: "%s · Gestión",
  },
  description: "Usuarios, cuentas y archivos en un solo espacio.",
};
const motionScript = `try{var m=localStorage.getItem("motion");if(m==="full"||m==="reduced")document.documentElement.dataset.motion=m}catch(e){}`;
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
