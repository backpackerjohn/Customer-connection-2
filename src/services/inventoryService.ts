export interface Vehicle {
  stock: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  vin: string;
  msrp: string;
  exteriorColor: string;
  interiorColor: string;
}

// Simulated inventory from a "CSV"
const inventory: Vehicle[] = [
  {
    stock: "P1234",
    year: "2024",
    make: "Toyota",
    model: "Camry",
    trim: "XSE",
    vin: "4T1BF1FKXPU123456",
    msrp: "$36,750",
    exteriorColor: "Wind Chill Pearl",
    interiorColor: "Black Leather"
  },
  {
    stock: "N5678",
    year: "2025",
    make: "Honda",
    model: "CR-V",
    trim: "Sport Touring Hybrid",
    vin: "5J8YR1H76SL654321",
    msrp: "$41,500",
    exteriorColor: "Canyon River Blue",
    interiorColor: "Gray"
  },
  {
    stock: "U9999",
    year: "2023",
    make: "Ford",
    model: "F-150",
    trim: "Lariat",
    vin: "1FTFW1E5XPK999999",
    msrp: "$58,200",
    exteriorColor: "Agate Black",
    interiorColor: "Baja Tan"
  }
];

export async function lookupVehicleByStock(stock: string): Promise<Vehicle | null> {
  // Normalize stock number
  const cleanStock = stock.trim().toUpperCase();
  const vehicle = inventory.find(v => v.stock === cleanStock);
  
  // Simulate network delay
  return new Promise((resolve) => {
    setTimeout(() => resolve(vehicle || null), 500);
  });
}
