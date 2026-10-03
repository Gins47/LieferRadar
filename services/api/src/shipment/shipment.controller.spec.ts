import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentView } from '../logistics/model/shipment-view.model';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';

describe('ShipmentController', () => {
  const shipmentView: ShipmentView = {
    id: 'SHP-001',
    supplier: {
      id: 'SUP-001',
      name: 'Stuttgart Components GmbH',
      location: { city: 'Stuttgart', countryCode: 'DE' },
    },
    product: { id: 'PROD-001', sku: 'ECU-CTRL-01', name: 'ECU Controller' },
    quantity: 2000,
    pickupLocation: { city: 'Stuttgart', countryCode: 'DE' },
    destination: { city: 'Munich', countryCode: 'DE' },
    plannedRoute: ['A8'],
    status: 'IN_TRANSIT',
    pickupAt: new Date('2026-10-05T08:00:00.000Z'),
    plannedDeliveryAt: new Date('2026-10-05T14:00:00.000Z'),
  };

  let controller: ShipmentController;
  let shipmentService: { getShipment: jest.Mock };

  beforeEach(async () => {
    shipmentService = {
      getShipment: jest.fn().mockResolvedValue(shipmentView),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShipmentController],
      providers: [{ provide: ShipmentService, useValue: shipmentService }],
    }).compile();

    controller = module.get<ShipmentController>(ShipmentController);
  });

  it('returns the requested shipment view', async () => {
    await expect(controller.getShipment('SHP-001')).resolves.toEqual(
      shipmentView,
    );
    expect(shipmentService.getShipment).toHaveBeenCalledWith('SHP-001');
  });
});
