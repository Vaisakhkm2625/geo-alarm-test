import { Component, OnInit, OnDestroy } from '@angular/core';
import { GeoLocationService, LocationData, ProximityStatus } from '../services/geo-location.service';
import { AudioService } from '../services/audio.service';
import * as L from 'leaflet';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  // Map properties
  map: L.Map | null = null;
  userMarker: L.Marker | null = null;
  targetMarker: L.Marker | null = null;
  fenceCircle: L.Circle | null = null;

  // Alarm state
  alarmRadius: number = 100;
  targetLatLng: L.LatLng | null = null;
  isTracking: boolean = false;
  isAlarmTriggered: boolean = false;
  statusMessage: string = 'Status: Waiting for target location...';
  statusClass: string = '';
  distance: number = 0;

  // Subscriptions
  private locationSubscription: Subscription | null = null;
  private proximitySubscription: Subscription | null = null;
  private alarmInterval: NodeJS.Timeout | null = null;

  constructor(
    private geoLocationService: GeoLocationService,
    private audioService: AudioService
  ) {}

  ngOnInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    this.stopTracking();
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
    if (this.proximitySubscription) {
      this.proximitySubscription.unsubscribe();
    }
  }

  /**
   * Initialize Leaflet Map
   */
  initializeMap(): void {
    this.map = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    // Get user's initial location
    this.geoLocationService
      .getCurrentLocation()
      .then((location) => {
        const initCoords: [number, number] = [location.latitude, location.longitude];
        if (this.map) {
          this.map.setView(initCoords, 15);
        }
        this.userMarker = L.marker(initCoords, { title: 'You are here' })
          .addTo(this.map!)
          .bindPopup('You are here')
          .openPopup();
      })
      .catch((error) => {
        console.error('Error getting initial location:', error);
        this.updateStatus('Error: Could not get initial location', 'error');
      });

    // Handle map clicks to set target
    if (this.map) {
      this.map.on('click', (e: L.LeafletMouseEvent) => {
        this.setTarget(e.latlng);
      });
    }
  }

  /**
   * Set target location from map click
   */
  setTarget(latlng: L.LatLng): void {
    this.targetLatLng = latlng;

    // Remove existing markers/circles
    if (this.targetMarker) {
      this.map?.removeLayer(this.targetMarker);
    }
    if (this.fenceCircle) {
      this.map?.removeLayer(this.fenceCircle);
    }

    // Add new markers and geofence
    this.targetMarker = L.marker(latlng, { draggable: false })
      .addTo(this.map!)
      .bindPopup('Target Destination')
      .openPopup();

    this.fenceCircle = L.circle(latlng, {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.2,
      radius: this.alarmRadius
    }).addTo(this.map!);

    this.updateStatus('Status: Target set. Ready to track.', 'active');
  }

  /**
   * Update geofence radius dynamically
   */
  onRadiusChange(value: number): void {
    this.alarmRadius = value;
    if (this.fenceCircle) {
      this.fenceCircle.setRadius(value);
    }
  }

  /**
   * Start GPS tracking
   */
  async startTracking(): Promise<void> {
    if (!this.targetLatLng) {
      this.updateStatus('Error: No target set', 'error');
      return;
    }

    try {
      // Resume audio context
      this.audioService.resumeAudioContext();

      // Start geolocation tracking
      await this.geoLocationService.startTracking();
      this.isTracking = true;

      // Subscribe to location updates
      this.locationSubscription = this.geoLocationService.location$.subscribe(
        (location: LocationData | null) => {
          if (location && this.targetLatLng) {
            this.updateUserMarker(location);
            this.checkProximity(location);
          }
        }
      );

      this.updateStatus('Status: Tracking active. Monitoring distance...', 'active');
    } catch (error) {
      console.error('Error starting tracking:', error);
      this.updateStatus('Error: Could not start tracking', 'error');
    }
  }

  /**
   * Update user marker on map
   */
  updateUserMarker(location: LocationData): void {
    const userLatLng = L.latLng(location.latitude, location.longitude);

    if (this.userMarker) {
      this.userMarker.setLatLng(userLatLng);
    } else {
      this.userMarker = L.marker(userLatLng).addTo(this.map!);
    }

    // Pan map to follow user
    if (this.map) {
      this.map.panTo(userLatLng);
    }
  }

  /**
   * Check proximity to target
   */
  checkProximity(location: LocationData): void {
    if (!this.targetLatLng) return;

    const proximityStatus = this.geoLocationService.checkProximity(
      location.latitude,
      location.longitude,
      this.targetLatLng.lat,
      this.targetLatLng.lng,
      this.alarmRadius
    );

    this.distance = proximityStatus.distance;

    if (proximityStatus.isWithinRadius) {
      this.triggerAlarm(proximityStatus.distance);
    } else {
      if (this.isAlarmTriggered) {
        this.stopAlarm();
      }
      this.updateStatus(
        `Status: Tracking... Distance to target: ${Math.round(proximityStatus.distance)}m`,
        'active'
      );
    }
  }

  /**
   * Trigger alarm when user is within radius
   */
  triggerAlarm(distance: number): void {
    if (this.isAlarmTriggered) return;

    this.isAlarmTriggered = true;
    this.updateStatus(
      `🚨 ALARM! You are within ${Math.round(distance)}m of the target!`,
      'alarm-triggered'
    );

    // Start alarm sound
    if (!this.alarmInterval) {
      this.alarmInterval = this.audioService.startAlarm(800);
    }
  }

  /**
   * Stop alarm
   */
  async stopAlarm(): Promise<void> {
    if (this.alarmInterval) {
      this.audioService.stopAlarm(this.alarmInterval);
      this.alarmInterval = null;
    }
    this.isAlarmTriggered = false;
    await this.stopTracking();
  }

  /**
   * Stop tracking
   */
  async stopTracking(): Promise<void> {
    try {
      await this.geoLocationService.stopTracking();
      if (this.locationSubscription) {
        this.locationSubscription.unsubscribe();
      }
      this.isTracking = false;
      this.updateStatus('Status: Tracking stopped.', '');
    } catch (error) {
      console.error('Error stopping tracking:', error);
    }
  }

  /**
   * Update status message
   */
  updateStatus(message: string, className: string): void {
    this.statusMessage = message;
    this.statusClass = className;
  }
}
