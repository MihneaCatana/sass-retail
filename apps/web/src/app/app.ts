import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ErrorToastOutlet } from './core/feedback/error-toast-outlet';

/** Root component: a bare outlet — every zone owns its own chrome. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ErrorToastOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}

