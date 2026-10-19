import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root component: a bare outlet — every zone owns its own chrome. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}

