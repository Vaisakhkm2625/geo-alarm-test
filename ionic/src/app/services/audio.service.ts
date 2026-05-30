import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AudioService {
  private audioContext: AudioContext | null = null;
  private isAlarmPlayingSubject = new BehaviorSubject<boolean>(false);
  public isAlarmPlaying$: Observable<boolean> = this.isAlarmPlayingSubject.asObservable();

  constructor() {
    this.initializeAudioContext();
  }

  private initializeAudioContext(): void {
    if (typeof window !== 'undefined') {
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioContext = new AudioContextClass();
      }
    }
  }

  /**
   * Play a single beep sound using Web Audio API
   */
  playBeep(frequency: number = 880, duration: number = 0.15): void {
    if (!this.audioContext) {
      this.initializeAudioContext();
    }

    if (!this.audioContext) {
      console.warn('Web Audio API not available');
      return;
    }

    try {
      const now = this.audioContext.currentTime;
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.value = frequency;

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.00001, now + duration);

      osc.connect(gain);
      gain.connect(this.audioContext.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (error) {
      console.error('Error playing beep:', error);
    }
  }

  /**
   * Play dual-tone alarm (880Hz and 660Hz)
   */
  playDualToneAlarm(): void {
    this.playBeep(880, 0.15);
    setTimeout(() => {
      this.playBeep(660, 0.15);
    }, 200);
  }

  /**
   * Start continuous alarm sound
   */
  startAlarm(interval: number = 800): NodeJS.Timeout {
    this.isAlarmPlayingSubject.next(true);
    return setInterval(() => {
      this.playDualToneAlarm();
    }, interval);
  }

  /**
   * Stop alarm sound
   */
  stopAlarm(alarmInterval: NodeJS.Timeout): void {
    if (alarmInterval) {
      clearInterval(alarmInterval);
    }
    this.isAlarmPlayingSubject.next(false);
  }

  /**
   * Resume audio context if suspended
   */
  resumeAudioContext(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}
