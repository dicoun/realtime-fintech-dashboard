import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { ProducerFacade } from './core/producer/producer.facade';
import { ProducerSettingsStore } from './core/producer/producer-settings.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideAppInitializer(() => {
      inject(ProducerFacade).start(inject(ProducerSettingsStore).applied());
    }),
  ],
};
