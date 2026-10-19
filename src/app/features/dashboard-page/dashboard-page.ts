import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { presentInstrument } from '../../core/market/instrument-metrics';
import { MarketTableStore } from '../../core/market/market-table.store';
import { ProducerFacade } from '../../core/producer/producer.facade';

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly table = inject(MarketTableStore);
  private readonly producer = inject(ProducerFacade);

  public readonly rows = computed(() => this.table.rows().map(presentInstrument));
  public readonly errorMessage = this.producer.errorMessage;
}
