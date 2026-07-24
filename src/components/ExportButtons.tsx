import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv, exportToPdf } from "@/lib/exportUtils";

export function ExportButtons({
  filename,
  title,
  columns,
  rows,
  subtitle,
}: {
  filename: string;
  title: string;
  columns: string[];
  rows: (string | number)[][];
  subtitle?: string;
}) {
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant="outline" onClick={() => exportToCsv(filename, columns, rows)} className="gap-1.5">
        <Download className="size-3.5" /> CSV
      </Button>
      <Button size="sm" variant="outline" onClick={() => exportToPdf(title, columns, rows, subtitle)} className="gap-1.5">
        <Printer className="size-3.5" /> PDF
      </Button>
    </div>
  );
}
