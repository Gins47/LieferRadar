import { OperationsController } from './operations.controller';

describe('OperationsController', () => {
  it('delegates shipment-list and shipment-detail reads to OperationsService', async () => {
    const operations = {
      getShipments: jest.fn().mockResolvedValue({ totalShipments: 4 }),
      getShipment: jest.fn().mockResolvedValue({
        shipment: { id: 'SHP-003' },
      }),
      getWarnings: jest.fn(),
    };
    const controller = new OperationsController(operations as never);

    await expect(controller.getShipments()).resolves.toEqual({
      totalShipments: 4,
    });
    await expect(controller.getShipment('SHP-003')).resolves.toEqual({
      shipment: { id: 'SHP-003' },
    });
    expect(operations.getShipment).toHaveBeenCalledWith('SHP-003');
  });
});
