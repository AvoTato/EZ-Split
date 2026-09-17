import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PURPLE = '#9B87F0';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Ionicons name="menu" size={26} color="#000" style={styles.menuIcon} />
          <Image
            source={require('../../../assets/images/ezsplit-logo.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        <Text style={styles.welcome}>Welcome!</Text>

        <View style={styles.buttons}>
          <Pressable style={styles.button} onPress={() => router.push('/upload-file')}>
            <Text style={styles.buttonText}>Instant settlement</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => router.push('/create-group-settlement')}>
            <Text style={styles.buttonText}>Create group settlement</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuIcon: {
    marginRight: 16,
  },
  logo: {
    width: 150,
    height: 48,
  },
  welcome: {
    fontSize: 36,
    fontWeight: '800',
    color: '#000',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  buttons: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 40,
  },
  button: {
    backgroundColor: PURPLE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
});
