import { Injectable } from '@angular/core';
import { Geolocation, GeolocationOptions } from '@capacitor/geolocation';
import { BehaviorSubject, Observable } from 'rxjs';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface ProximityStatus {
  distance: number;
  isWithinRadius: boolean;
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class GeoLocationService {
  private locationSubject = new BehaviorSubject<LocationData | null>(null);
  private proximitySubject = new BehaviorSubject<ProximityStatus | null>(null);
  private watchId: string | null = null;

  public location$: Observable<LocationData | null> = this.locationSubject.asObservable();
  public proximity$: Observable<ProximityStatus | null> = this.proximitySubject.asObservable();

  constructor() {}

  /**
   * Get current user location once
   */
  async getCurrentLocation(): Promise<LocationData> {
    try {
      const coordinates = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });

      const locationData: LocationData = {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude,
        accuracy: coordinates.coords.accuracy || 0,
        timestamp: coordinates.timestamp
      };

      this.locationSubject.next(locationData);
      return locationData;
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }

  /**
   * Start continuous GPS tracking
   */
  async startTracking(): Promise<void> {
    try {
      const options: GeolocationOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      this.watchId = await Geolocation.watchPosition(options, (position, err) => {
        if (err) {
          console.error('Watch position error:', err);
          return;
        }

        if (position) {
          const locationData: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            timestamp: position.timestamp
          };
          this.locationSubject.next(locationData);
        }
      });
    } catch (error) {
      console.error('Error starting tracking:', error);
      throw error;
    }
  }

  /**
   * Stop continuous GPS tracking
   */
  async stopTracking(): Promise<void> {
    if (this.watchId) {
      try {
        await Geolocation.clearWatch({ id: this.watchId });
        this.watchId = null;
      } catch (error) {
        console.error('Error stopping tracking:', error);
      }
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Check proximity to target location
   */
  checkProximity(
    userLat: number,
    userLon: number,
    targetLat: number,
    targetLon: number,
    radiusMeters: number
  ): ProximityStatus {
    const distance = this.calculateDistance(userLat, userLon, targetLat, targetLon);
    const proximityStatus: ProximityStatus = {
      distance,
      isWithinRadius: distance <= radiusMeters,
      timestamp: Date.now()
    };

    this.proximitySubject.next(proximityStatus);
    return proximityStatus;
  }

  isTracking(): boolean {
    return this.watchId !== null;
  }
}
