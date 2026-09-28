import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export type PickedImage = {
  uri: string;
  base64: string;
  width: number;
  height: number;
};

type Source = 'camera' | 'library';

// Lower quality keeps the base64 payload small so the OCR request is fast.
const PICKER_OPTIONS = { quality: 0.5, base64: true } as const;

function toPickedImage(result: ImagePicker.ImagePickerResult): PickedImage | null {
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset.base64) {
    Alert.alert('Could not read receipt', 'Please try another photo.');
    return null;
  }
  return { uri: asset.uri, base64: asset.base64, width: asset.width, height: asset.height };
}

async function takePhoto(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Camera permission needed', 'Please allow camera access to scan a receipt.');
    return null;
  }
  return toPickedImage(await ImagePicker.launchCameraAsync(PICKER_OPTIONS));
}

async function chooseFromLibrary(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photos permission needed', 'Please allow photo access to upload a receipt.');
    return null;
  }
  return toPickedImage(await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS));
}

/**
 * Lets the user take a photo or choose one from their library. `pick()` opens a bottom sheet
 * (a Modal, so it behaves the same on iOS, Android and web — Alert.alert is a no-op on web)
 * and resolves to null if they cancel. Render `sheet` once in the screen.
 */
export function useReceiptPicker() {
  const [visible, setVisible] = useState(false);
  const resolver = useRef<((value: PickedImage | null) => void) | null>(null);

  const finish = useCallback((value: PickedImage | null) => {
    resolver.current?.(value);
    resolver.current = null;
  }, []);

  const pick = useCallback(() => {
    return new Promise<PickedImage | null>((resolve) => {
      resolver.current = resolve;
      setVisible(true);
    });
  }, []);

  const choose = async (source: Source) => {
    setVisible(false);
    try {
      finish(await (source === 'camera' ? takePhoto() : chooseFromLibrary()));
    } catch {
      finish(null);
    }
  };

  const cancel = () => {
    setVisible(false);
    finish(null);
  };

  const sheet = (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <Pressable style={styles.backdrop} onPress={cancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Pressable style={styles.option} onPress={() => choose('camera')}>
            <Ionicons name="camera" size={20} color="#000" />
            <Text style={styles.optionText}>Take Photo</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={() => choose('library')}>
            <Ionicons name="images" size={20} color="#000" />
            <Text style={styles.optionText}>Choose from Library</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.option} onPress={cancel}>
            <Text style={[styles.optionText, styles.cancelText]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return { pick, sheet };
}

const styles = StyleSheet.create({
  backdrop: {
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  cancelText: {
    color: '#c0392b',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginHorizontal: 24,
  },
});
