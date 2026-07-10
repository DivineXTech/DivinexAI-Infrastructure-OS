import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createProductAction } from "@/modules/products/actions";

const IMPLEMENTED_PRODUCT_TYPES = [
  { value: "downloadable_file", label: "Downloadable file" },
  { value: "course", label: "Course" },
  { value: "service", label: "Service" },
  { value: "membership", label: "Membership" },
  { value: "bundle", label: "Bundle" },
];

export default async function NewProductPage() {
  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase.from("product_categories").select("id, name").eq("is_active", true).order("sort_order");

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>New product</CardTitle>
        <CardDescription>Start with the basics — you can add pricing, media, and files next.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createProductAction} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="Small-Business Branding Kit" required minLength={3} />
          </div>
          <div>
            <Label htmlFor="productType">Product type</Label>
            <Select id="productType" name="productType" required defaultValue="downloadable_file">
              {IMPLEMENTED_PRODUCT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="categoryId">Category</Label>
            <Select id="categoryId" name="categoryId">
              <option value="">Select a category</option>
              {(categories ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" className="w-full">
            Continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
