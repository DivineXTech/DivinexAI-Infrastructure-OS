export type EquipmentCategory = {
  slug: string;
  name: string;
  description: string;
};

export const EQUIPMENT_CATEGORIES: EquipmentCategory[] = [
  { slug: "heat-presses", name: "Heat Presses", description: "Core equipment for transfer, DTF, and sublimation printing." },
  { slug: "dtf-printers", name: "DTF Printers", description: "Direct-to-film printers for full-color, durable designs." },
  { slug: "sublimation-printers", name: "Sublimation Printers", description: "All-over-print systems for polyester and poly-blend garments." },
  { slug: "vinyl-cutters", name: "Vinyl Cutters", description: "Precision cutting for heat-transfer vinyl designs and text." },
  { slug: "embroidery-machines", name: "Embroidery Machines", description: "Stitched logos, patches, and premium finishing." },
  { slug: "screen-printing", name: "Screen-Printing Equipment", description: "High-volume printing for established production runs." },
  { slug: "dryers-curing", name: "Dryers and Curing Equipment", description: "Proper curing for durable, wash-safe prints." },
  { slug: "work-tables", name: "Work Tables", description: "Production-ready surfaces for pressing and finishing." },
  { slug: "packaging-equipment", name: "Packaging Equipment", description: "Bagging, labeling, and fulfillment-ready packaging tools." },
  { slug: "photography-equipment", name: "Photography Equipment", description: "Product photography setups for your storefront." },
  { slug: "computers-software", name: "Computers and Software", description: "Design and production software recommendations." },
  { slug: "maintenance-supplies", name: "Maintenance Supplies", description: "Keep your equipment running at production quality." },
];
