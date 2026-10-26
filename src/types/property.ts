export type ListingIntent = "Buy" | "Rent";
export type PropertyType = "Apartment" | "Villa" | "Independent House" | "Plot";
export type PropertyStatus = "Ready to Move" | "Under Construction";

export interface PropertyImage {
  src: string;
  alt: string;
  kind: "listing" | "illustrative";
}

export interface Property {
  id: string;
  title: string;
  listingIntent: ListingIntent;
  propertyType: PropertyType;
  price: number;
  locality: string;
  city: "Nagpur";
  latitude: number;
  longitude: number;
  image: PropertyImage;
  /** Ordered public images for the published revision. `image` remains the cover for compatibility. */
  images?: readonly PropertyImage[];
  bedrooms: number;
  bathrooms: number;
  areaSqFt: number;
  status: PropertyStatus;
  reraApproved: boolean;
  description?: string;
  state?: string;
  postalCode?: string;
  reraNumber?: string;
  badge?: "Featured" | "New";
}

export interface PropertyFiltersState {
  query: string;
  intent: ListingIntent;
  propertyType: PropertyType | "All";
  maxPrice: number | null;
  bedrooms: number | null;
}
