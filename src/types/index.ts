export interface Owner {
  id: string
  name: string
  phone: string
  publicKey: string
  createdAt: string
}

export interface CustomField {
  name: string
  value: string
  showOnFront?: boolean
  fieldType?: 'text' | 'counter' | 'status'
  // Counter: reminder at date OR mileage
  counterDate?: string
  counterTargetMileage?: number
  counterEventType?: string
  counterCustomEvent?: string
}

export interface Car {
  id: string
  ownerId: string
  brand: string
  model: string
  year: number | null
  vin: string
  plate: string
  fuelType: string
  currentMileage: number
  // Дополнительные поля (как в СТС)
  color?: string
  bodyType?: string
  enginePower?: string
  engineVolume?: string
  chassisNumber?: string
  ptsNumber?: string
  stsNumber?: string
  registrationDate?: string
  weight?: string
  maxWeight?: string
  customFields?: CustomField[]
  // Страховка
  insuranceNumber?: string
  insuranceStartDate?: string
  insuranceEndDate?: string
}

export interface ServiceWork {
  name: string
  price: number
}

export interface ServicePart {
  name: string
  quantity: number
  price: number
}

export interface ServiceRecord {
  id: string
  carId: string
  serviceId: string
  serviceName: string
  date: string
  mileage: number
  works: ServiceWork[]
  parts: ServicePart[]
  totalCost: number
  status: 'in_progress' | 'ready' | 'paid'
  signature: string
}

export interface FuelRecord {
  id: string
  carId: string
  date: string
  liters: number
  mileage: number
  consumption: number | null
}

export interface MaintenancePrediction {
  carId: string
  nextOilChange: { mileage: number | null; date: string | null }
  nextInspection: { mileage: number | null; date: string | null }
}

export interface Task {
  id: string
  carId: string
  title: string
  description: string
  date: string
  status: 'planned' | 'in_progress' | 'done'
  createdAt: string
}

export type TaskStatus = 'planned' | 'in_progress' | 'done'
export type StampStatus = 'in_progress' | 'ready' | 'paid'
export type StampSize = 'sm' | 'md' | 'lg'
