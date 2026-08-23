export interface Product {
  id: string;
  title: string;
  price: number;
  location: string;
  image: string;
  category: string;
  isNew?: boolean;
  isFeatured?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  { id: '1', name: 'Vehículos', icon: 'car-outline' },
  { id: '2', name: 'Móviles', icon: 'phone-portrait-outline' },
  { id: '3', name: 'Hogar', icon: 'home-outline' },
  { id: '4', name: 'Moda', icon: 'shirt-outline' },
  { id: '5', name: 'Empleo', icon: 'briefcase-outline' },
  { id: '6', name: 'Servicios', icon: 'construct-outline' },
  { id: '7', name: 'Inmuebles', icon: 'business-outline' },
  { id: '8', name: 'Libros', icon: 'book-outline' },
  { id: '10', name: 'Seguros', icon: 'shield-outline' },
  { id: '9', name: 'Otros', icon: 'grid-outline' },
];

export const PRODUCTS: Product[] = [
  {
    id: '1',
    title: 'iPhone 15 Pro 256GB - Como nuevo',
    price: 950,
    location: 'Managua',
    image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?w=800&auto=format&fit=crop&q=60',
    category: 'Móviles',
    isNew: true,
    isFeatured: false,
  },
  {
    id: '2',
    title: 'Bicicleta de montaña Rockrider',
    price: 320,
    location: 'León',
    image: 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800&auto=format&fit=crop&q=60',
    category: 'Deportes',
  },
  {
    id: '3',
    title: 'Sofá 3 plazas casi sin uso',
    price: 450,
    location: 'Granada',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=60',
    category: 'Hogar',
  },
  {
    id: '4',
    title: 'MacBook Air M2 2023',
    price: 1100,
    location: 'Estelí',
    image: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop&q=60',
    category: 'Informática',
    isFeatured: false,
  },
  {
    id: '5',
    title: 'Coche Toyota Corolla 2018',
    price: 15500,
    location: 'Managua',
    image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&auto=format&fit=crop&q=60',
    category: 'Vehículos',
  },
  {
    id: '6',
    title: 'Zapatillas Nike Air Jordan 1',
    price: 120,
    location: 'Masaya',
    image: 'https://images.unsplash.com/photo-1584908191113-394f7e95646c?w=800&auto=format&fit=crop&q=60',
    category: 'Moda',
    isNew: true,
  },
];


export const POPULAR_SEARCHES = ['iPhone', 'Toyota', 'Moto', 'Sofá', 'Ropa', 'Trabajo'];
