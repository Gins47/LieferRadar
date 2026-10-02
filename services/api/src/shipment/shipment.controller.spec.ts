import { Test, TestingModule } from '@nestjs/testing';
import { LogisticsModule } from '../logistics/logistics.module';
import { ShipmentController } from './shipment.controller';
import { ShipmentService } from './shipment.service';

describe('ShipmentController', () => {
  let controller: ShipmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LogisticsModule],
      controllers: [ShipmentController],
      providers: [ShipmentService],
    }).compile();

    controller = module.get<ShipmentController>(ShipmentController);
  });

  it('returns the requested shipment view', () => {
    expect(controller.getShipment('SHP-001').id).toBe('SHP-001');
  });
});
