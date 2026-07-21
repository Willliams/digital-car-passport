import Dexie, { type Table } from 'dexie'
import type { Owner, Car, ServiceRecord, FuelRecord, MaintenancePrediction, Task } from '@/types'

export class CarPassportDB extends Dexie {
  owners!: Table<Owner>
  cars!: Table<Car>
  services!: Table<ServiceRecord>
  fuel!: Table<FuelRecord>
  predictions!: Table<MaintenancePrediction>
  tasks!: Table<Task>

  constructor() {
    super('CarPassportDB')
    this.version(4).stores({
      owners: 'id',
      cars: 'id, ownerId',
      services: 'id, carId, date',
      fuel: 'id, carId, date',
      predictions: 'carId',
      tasks: 'id, carId, date, status'
    }).upgrade(tx => {
      return tx.table('cars').toCollection().modify(car => {
        if (!car.fuelType) car.fuelType = 'АИ-92'
        if (!car.color) car.color = ''
        if (!car.bodyType) car.bodyType = ''
        if (!car.enginePower) car.enginePower = ''
        if (!car.engineVolume) car.engineVolume = ''
        if (!car.chassisNumber) car.chassisNumber = ''
        if (!car.ptsNumber) car.ptsNumber = ''
        if (!car.stsNumber) car.stsNumber = ''
        if (!car.registrationDate) car.registrationDate = ''
        if (!car.weight) car.weight = ''
        if (!car.maxWeight) car.maxWeight = ''
      })
    })
  }
}

export const db = new CarPassportDB()
