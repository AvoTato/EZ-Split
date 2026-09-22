import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from "expo-router";
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { setPendingImage } from '../lib/receiptSession';

const PURPLE = '#9B87F0';

export default function UploadScreen() {

  const router = useRouter();
  const [pickerVisible, setPickerVisible] = useState(false);

  const goToReceiptProcessing = (base64: string) => {
    setPendingImage(base64);
    router.push('/receipt-processing');
  };

  const handleImageResult = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.base64) {
      goToReceiptProcessing(asset.base64);
    }
  };

  const takePhoto = async () => {
    setPickerVisible(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Please allow camera access to scan a receipt.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    handleImageResult(result);
  };

  const chooseFromLibrary = async () => {
    setPickerVisible(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos permission needed', 'Please allow photo access to upload a receipt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true });
    handleImageResult(result);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Ionicons name="chevron-back" size={26} color="#000" />
            </Pressable>
              <Text style={styles.headerTitle}>Instant Settlement</Text>
          </View>

         <View style={styles.container}>
            <TouchableOpacity style={styles.button} onPress={() => setPickerVisible(true)} activeOpacity={0.7}>
              <Text style={styles.buttonText}>Take/Upload Receipt</Text>
            </TouchableOpacity>
          </View>

      </View>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerVisible(false)}>
          <View style={styles.sheet}>
            <TouchableOpacity style={styles.sheetOption} onPress={takePhoto} activeOpacity={0.7}>
              <Ionicons name="camera" size={20} color="#000" />
              <Text style={styles.sheetOptionText}>Take Photo</Text>
            </TouchableOpacity>
            <View style={styles.sheetDivider} />
            <TouchableOpacity style={styles.sheetOption} onPress={chooseFromLibrary} activeOpacity={0.7}>
              <Ionicons name="images" size={20} color="#000" />
              <Text style={styles.sheetOptionText}>Choose from Library</Text>
            </TouchableOpacity>
            <View style={styles.sheetDivider} />
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={() => setPickerVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sheetOptionText, styles.sheetCancelText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: 'center',
    alignItems: "center",
  },
  container: {
    flex: 1,
    justifyContent: 'center', // Centers vertically in the parent view
    alignItems: 'center',     // Centers horizontally in the parent view
  },
  button: {
    width: 300,               // Makes the button wider (larger)
    height: 150,               // Makes the button taller (larger)
    backgroundColor: '#eee',
    justifyContent: 'center', // Centers text/icon vertically inside the button
    alignItems  : 'center',     // Centers text/icon horizontally inside the button
    borderRadius: 8,

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 }, // X and Y displacement
    shadowOpacity: 0.2,                   // Opacity/intensity of the shadow
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
  },
  divider: {
    height: 2,
    backgroundColor: '#000',
    marginHorizontal: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  sheetOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  sheetCancelText: {
    color: '#c0392b',
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginHorizontal: 24,
  },
});
