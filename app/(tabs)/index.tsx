import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Button, Platform, Dimensions } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import axios from 'axios';
import { getDistance } from 'geolib';

const LOCATION_TASK_NAME = 'background-location-task';

const { width, height } = Dimensions.get('window'); // For responsive layout

interface LocationData {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  address: string | null;
}

const RealTimeLocation: React.FC = () => {
  const [locationData, setLocationData] = useState<LocationData>({
    latitude: 0,
    longitude: 0,
    altitude: null,
    accuracy: null,
    address: null,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backgroundLocation, setBackgroundLocation] = useState<LocationData | null>(null);

  const fetchLocationData = useCallback(async () => {
    setIsLoading(true);

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude, altitude, accuracy } = location.coords;

      let elevation: number | null = altitude;
      try {
        const elevationResponse = await axios.get(
          `https://api.opentopodata.org/v1/test-dataset?locations=${latitude},${longitude}`
        );
        elevation = elevationResponse.data.results[0]?.elevation ?? altitude;
      } catch (e) {
        console.warn('Elevation fetch failed, using GPS altitude');
      }

      let address = null;
      try {
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        const addressData = reverseGeocode[0];
        address = addressData
          ? `${addressData.name}, ${addressData.city}, ${addressData.region}, ${addressData.country}`
          : 'Address not found';
      } catch (e) {
        console.warn('Reverse geocode failed');
      }

      setLocationData({
        latitude,
        longitude,
        altitude: elevation,
        accuracy,
        address,
      });
    } catch (error) {
      console.error('Error fetching location data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initializeLocationUpdates = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Permission to access location was denied');
          return;
        }
        await fetchLocationData();
      } catch (error) {
        console.error('Error initializing location updates:', error);
      }
    };

    initializeLocationUpdates();
  }, [fetchLocationData]);

  useEffect(() => {
    TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        const { locations } = data;
        const { latitude, longitude, altitude, accuracy } = locations[0].coords;

        let elevation: number | null = altitude;
        try {
          const elevationResponse = await axios.get(
            `https://api.opentopodata.org/v1/test-dataset?locations=${latitude},${longitude}`
          );
          elevation = elevationResponse.data.results[0]?.elevation ?? altitude;
        } catch (e) {
          console.warn('Elevation fetch failed in background task');
        }

        setBackgroundLocation({
          latitude,
          longitude,
          altitude: elevation,
          accuracy,
          address: 'Address in background not fetched',
        });
      }
    });

    return () => {
      Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    };
  }, []);

  const startBackgroundLocationUpdates = async () => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status === 'granted') {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 20000,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
      });
    } else {
      console.warn('Background location permissions not granted');
    }
  };

  const stopBackgroundLocationUpdates = async () => {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('Background location updates stopped');
    } catch (error) {
      console.error('Error stopping background location updates:', error);
    }
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      startBackgroundLocationUpdates();
    }

    return () => {
      stopBackgroundLocationUpdates();
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Real-Time Elevation & Location</Text>

      <View style={styles.infoContainer}>
        <Text style={styles.addressText}>📍 Address: {locationData.address || 'Fetching...'}</Text>
        <Text style={styles.infoText}>🌍 Latitude: {locationData.latitude.toFixed(6)}</Text>
        <Text style={styles.infoText}>🌍 Longitude: {locationData.longitude.toFixed(6)}</Text>
        <Text style={styles.infoText}>
          🗻 Elevation: {locationData.altitude ? `${locationData.altitude.toFixed(2)} meters` : 'Fetching...'}
        </Text>
        <Text style={styles.infoText}>
          🎯 Accuracy: {locationData.accuracy ? `${locationData.accuracy.toFixed(2)} meters` : 'Fetching...'}
        </Text>
      </View>

      {isLoading && <Text style={styles.loadingText}>Loading...</Text>}

      <Button title="Refresh Now" onPress={fetchLocationData} color="#4caf50" />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    padding: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#3b3b3b',
    textAlign: 'center',
    fontFamily: 'Roboto-Bold',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  infoContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    width: width - 40,
    marginVertical: 20,
  },
  addressText: {
    fontSize: 18,
    color: '#3f3f3f',
    fontWeight: 'bold',
    marginBottom: 15,
    fontFamily: 'Roboto-Medium',
  },
  infoText: {
    fontSize: 16,
    color: '#555555',
    marginVertical: 8,
    fontFamily: 'Roboto-Regular',
  },
  loadingText: {
    fontSize: 18,
    color: '#888',
    marginVertical: 20,
    fontFamily: 'Roboto-Regular',
  },
});

export default RealTimeLocation;