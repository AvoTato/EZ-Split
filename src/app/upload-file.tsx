import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Index() {
    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <TouchableOpacity style={styles.uploadButton}>
                    <Text style={styles.text}>Take/Upload Receipt</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF.',
        },
    text: {
        color: '#000',
    },
    uploadButton: {
        width: 250,          // Custom width
        height: 200,          // Custom height
        backgroundColor: '#eee',
        justifyContent: 'center', // Centers text vertically
        alignItems: 'center',     // Centers text horizontally
        borderRadius: 8,
        boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)', 

    },
    safeArea: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
    },
});