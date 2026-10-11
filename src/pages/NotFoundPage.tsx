import { Link } from "react-router";
import { Card } from "@/components/ui/Card";

export function NotFoundPage() {
  return (
    <Card className="text-center">
      <h1 className="text-2xl">Este rincón no existe</h1>
      <Link to="/" className="mt-4 inline-block font-semibold text-blush-500">
        Volver al inicio
      </Link>
    </Card>
  );
}
