import { Ionicons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PURPLE = '#9B87F0';


export default function UploadScreen() {

  const router = useRouter();
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
            <TouchableOpacity style={styles.button}>
              <Text style={styles.buttonText}>Take/Upload Receipt</Text>
            </TouchableOpacity>
          </View> 

      </View>
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
});
