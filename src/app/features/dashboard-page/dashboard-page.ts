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
  public readonly status = this.producer.status;
  public readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'running':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'starting':
        return 'Starting';
      case 'error':
        return 'Error';
      default:
        return 'Idle';
    }
  });

  public toggleProducer(): void {
    if (this.status() === 'paused') {
      this.producer.resume();
      return;
    }
    if (this.status() === 'running') {
      this.producer.pause();
    }
  }

  public canToggleProducer(): boolean {
    const status = this.status();
    return status === 'running' || status === 'paused';
  }
}
