// UI translations for major Gateway Languages
// Key format: 'component.element.description'

export interface TranslationStrings {
  // Chat
  'chat.placeholder': string;
  'chat.send': string;
  'chat.loading': string;
  'chat.welcome.title': string;
  'chat.welcome.subtitle': string;
  'chat.welcome.hint': string;
  'chat.changeLanguage': string;
  'chat.translateUi': string;
  
  // Scripture
  'scripture.title': string;
  'scripture.empty.title': string;
  'scripture.empty.description': string;
  'scripture.error.title': string;
  'scripture.error.notFound': string;
  'scripture.error.network': string;
  'scripture.error.generic': string;
  'scripture.retry': string;
  'scripture.selectHint': string;
  'scripture.clearFilter': string;
  'scripture.focused': string;
  
  // Resources
  'resources.title': string;
  'resources.empty.title': string;
  'resources.empty.description': string;
  'resources.notes': string;
  'resources.questions': string;
  'resources.words': string;
  'resources.academy': string;
  'resources.showMore': string;
  'resources.showLess': string;
  'resources.filtered': string;
  'resources.clearFilter': string;
  
  // Notes
  'notes.title': string;
  'notes.empty.title': string;
  'notes.empty.description': string;
  'notes.add': string;
  'notes.delete': string;
  'notes.placeholder': string;
  'notes.save': string;
  
  // History
  'history.title': string;
  'history.empty.title': string;
  'history.empty.description': string;
  'history.new': string;
  'history.startHint': string;
  
  // Navigation
  'nav.chat': string;
  'nav.resources': string;
  
  // Common
  'common.loading': string;
  'common.error': string;
  'common.cancel': string;
  'common.confirm': string;
  'common.save': string;
  'common.close': string;
  
  // Fallback/Translation
  'fallback.badge': string;
  'fallback.translate': string;
  'fallback.translateAll': string;
  'fallback.translating': string;
  'translation.dialog.title': string;
  'translation.dialog.titleBatch': string;
  'translation.dialog.description': string;
  'translation.dialog.descriptionBatch': string;
  'translation.dialog.keep': string;
  'translation.dialog.translate': string;
  'translation.dialog.disclaimer': string;
  
  // Language selector
  'language.title': string;
  'language.subtitle': string;
  'language.search': string;
  'language.organization': string;
  'language.continue': string;
}

export const translations: Record<string, TranslationStrings> = {
  // English (default)
  'en': {
    'chat.placeholder': 'Ask about any scripture passage...',
    'chat.send': 'Send',
    'chat.loading': 'Thinking...',
    'chat.welcome.title': 'Begin Your Study',
    'chat.welcome.subtitle': 'Ask about any passage, topic, or word. Swipe left to explore scripture and resources.',
    'chat.welcome.hint': 'Try: "Romans 3" or "What does justification mean?"',
    'chat.changeLanguage': 'Change language',
    'chat.translateUi': 'Translate UI',
    
    'scripture.title': 'Scripture',
    'scripture.empty.title': 'Scripture Passage',
    'scripture.empty.description': 'Start a conversation to see relevant scripture here',
    'scripture.error.title': 'Unable to Load Scripture',
    'scripture.error.notFound': 'The scripture reference could not be found. Please check the reference format.',
    'scripture.error.network': 'Network error. Please check your connection and try again.',
    'scripture.error.generic': 'Something went wrong while fetching the scripture data.',
    'scripture.retry': 'Try Again',
    'scripture.selectHint': 'Tap a verse to focus resources',
    'scripture.clearFilter': 'Tap verse again to clear filter',
    'scripture.focused': 'Focused',
    
    'resources.title': 'Resources',
    'resources.empty.title': 'Translation Resources',
    'resources.empty.description': 'Resources will appear here when you explore scripture',
    'resources.notes': 'Translation Notes',
    'resources.questions': 'Study Questions',
    'resources.words': 'Key Terms',
    'resources.academy': 'Academy Articles',
    'resources.showMore': 'Show more',
    'resources.showLess': 'Show less',
    'resources.filtered': 'Filtered to',
    'resources.clearFilter': 'Clear filter',
    
    'notes.title': 'Personal Notes',
    'notes.empty.title': 'Personal Notes',
    'notes.empty.description': 'Your notes will appear here. Select text from other cards to add.',
    'notes.add': 'Add note',
    'notes.delete': 'Delete',
    'notes.placeholder': 'Add a note...',
    'notes.save': 'Save Note',
    
    'history.title': 'History',
    'history.empty.title': 'No Conversations Yet',
    'history.empty.description': 'Your conversation history will appear here',
    'history.new': 'New Chat',
    'history.startHint': 'Start a new chat to begin',
    
    'nav.chat': 'Chat',
    'nav.resources': 'Resources',
    
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.save': 'Save',
    'common.close': 'Close',
    
    'fallback.badge': 'English fallback',
    'fallback.translate': 'Translate',
    'fallback.translateAll': 'Translate All',
    'fallback.translating': 'Translating...',
    'translation.dialog.title': 'Translate Content?',
    'translation.dialog.titleBatch': 'Translate All Content?',
    'translation.dialog.description': 'This content is only available in English. Would you like to use AI to translate it?',
    'translation.dialog.descriptionBatch': 'items are only available in English. Would you like to use AI to translate them all?',
    'translation.dialog.keep': 'Keep English',
    'translation.dialog.translate': 'Translate',
    'translation.dialog.disclaimer': 'AI translations may not be perfectly accurate. Use for reference only.',
    
    'language.title': 'Select Language',
    'language.subtitle': 'Choose your preferred language for Bible resources',
    'language.search': 'Search languages...',
    'language.organization': 'Resource provider',
    'language.continue': 'Continue',
  },
  
  // Spanish (Latin America)
  'es-419': {
    'chat.placeholder': 'Pregunta sobre cualquier pasaje bíblico...',
    'chat.send': 'Enviar',
    'chat.loading': 'Pensando...',
    'chat.welcome.title': 'Comienza Tu Estudio',
    'chat.welcome.subtitle': 'Pregunta sobre cualquier pasaje, tema o palabra. Desliza a la izquierda para explorar las Escrituras y los recursos.',
    'chat.welcome.hint': 'Intenta: "Romanos 3" o "¿Qué significa justificación?"',
    'chat.changeLanguage': 'Cambiar idioma',
    'chat.translateUi': 'Traducir interfaz',
    
    'scripture.title': 'Escritura',
    'scripture.empty.title': 'Pasaje Bíblico',
    'scripture.empty.description': 'Inicia una conversación para ver las Escrituras relevantes aquí',
    'scripture.error.title': 'No se puede cargar la Escritura',
    'scripture.error.notFound': 'No se encontró la referencia bíblica. Por favor verifica el formato.',
    'scripture.error.network': 'Error de red. Por favor verifica tu conexión e intenta de nuevo.',
    'scripture.error.generic': 'Algo salió mal al obtener los datos de las Escrituras.',
    'scripture.retry': 'Intentar de nuevo',
    'scripture.selectHint': 'Toca un versículo para enfocar recursos',
    'scripture.clearFilter': 'Toca el versículo de nuevo para quitar el filtro',
    'scripture.focused': 'Enfocado',
    
    'resources.title': 'Recursos',
    'resources.empty.title': 'Recursos de Traducción',
    'resources.empty.description': 'Los recursos aparecerán aquí cuando explores las Escrituras',
    'resources.notes': 'Notas de Traducción',
    'resources.questions': 'Preguntas de Estudio',
    'resources.words': 'Términos Clave',
    'resources.academy': 'Artículos de la Academia',
    'resources.showMore': 'Ver más',
    'resources.showLess': 'Ver menos',
    'resources.filtered': 'Filtrado a',
    'resources.clearFilter': 'Quitar filtro',
    
    'notes.title': 'Notas Personales',
    'notes.empty.title': 'Notas Personales',
    'notes.empty.description': 'Tus notas aparecerán aquí. Selecciona texto de otras tarjetas para agregar.',
    'notes.add': 'Agregar nota',
    'notes.delete': 'Eliminar',
    'notes.placeholder': 'Agregar una nota...',
    'notes.save': 'Guardar Nota',
    
    'history.title': 'Historial',
    'history.empty.title': 'Sin Conversaciones Aún',
    'history.empty.description': 'Tu historial de conversaciones aparecerá aquí',
    'history.new': 'Nuevo Chat',
    'history.startHint': 'Inicia un nuevo chat para comenzar',
    
    'nav.chat': 'Chat',
    'nav.resources': 'Recursos',
    
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.save': 'Guardar',
    'common.close': 'Cerrar',
    
    'fallback.badge': 'Respaldo en inglés',
    'fallback.translate': 'Traducir',
    'fallback.translateAll': 'Traducir Todo',
    'fallback.translating': 'Traduciendo...',
    'translation.dialog.title': '¿Traducir Contenido?',
    'translation.dialog.titleBatch': '¿Traducir Todo el Contenido?',
    'translation.dialog.description': 'Este contenido solo está disponible en inglés. ¿Deseas usar IA para traducirlo?',
    'translation.dialog.descriptionBatch': 'elementos solo están disponibles en inglés. ¿Deseas usar IA para traducirlos todos?',
    'translation.dialog.keep': 'Mantener en Inglés',
    'translation.dialog.translate': 'Traducir',
    'translation.dialog.disclaimer': 'Las traducciones de IA pueden no ser perfectamente precisas. Úsalas solo como referencia.',
    
    'language.title': 'Seleccionar Idioma',
    'language.subtitle': 'Elige tu idioma preferido para los recursos bíblicos',
    'language.search': 'Buscar idiomas...',
    'language.organization': 'Proveedor de recursos',
    'language.continue': 'Continuar',
  },
  
  // Portuguese (Brazil)
  'pt-br': {
    'chat.placeholder': 'Pergunte sobre qualquer passagem bíblica...',
    'chat.send': 'Enviar',
    'chat.loading': 'Pensando...',
    'chat.welcome.title': 'Assistente de Tradução Bíblica',
    'chat.welcome.subtitle': 'Pergunte sobre qualquer passagem das Escrituras para começar',
    'chat.welcome.hint': 'Tente: "Romanos 3" ou "O que significa justificação?"',
    'chat.changeLanguage': 'Mudar idioma',
    'chat.translateUi': 'Traduzir interface',
    
    'scripture.title': 'Escritura',
    'scripture.empty.title': 'Passagem Bíblica',
    'scripture.empty.description': 'Inicie uma conversa para ver as Escrituras relevantes aqui',
    'scripture.error.title': 'Não foi possível carregar a Escritura',
    'scripture.error.notFound': 'A referência bíblica não foi encontrada. Por favor, verifique o formato.',
    'scripture.error.network': 'Erro de rede. Por favor, verifique sua conexão e tente novamente.',
    'scripture.error.generic': 'Algo deu errado ao buscar os dados das Escrituras.',
    'scripture.retry': 'Tentar novamente',
    'scripture.selectHint': 'Toque em um versículo para focar recursos',
    'scripture.clearFilter': 'Toque no versículo novamente para limpar o filtro',
    'scripture.focused': 'Focado',
    
    'resources.title': 'Recursos',
    'resources.empty.title': 'Recursos de Tradução',
    'resources.empty.description': 'Os recursos aparecerão aqui quando você explorar as Escrituras',
    'resources.notes': 'Notas de Tradução',
    'resources.questions': 'Perguntas de Estudo',
    'resources.words': 'Termos-Chave',
    'resources.academy': 'Artigos da Academia',
    'resources.showMore': 'Ver mais',
    'resources.showLess': 'Ver menos',
    'resources.filtered': 'Filtrado para',
    'resources.clearFilter': 'Limpar filtro',
    
    'notes.title': 'Minhas Notas',
    'notes.empty.title': 'Notas Pessoais',
    'notes.empty.description': 'Selecione texto das Escrituras ou recursos para adicionar notas',
    'notes.add': 'Adicionar nota',
    'notes.delete': 'Excluir',
    'notes.placeholder': 'Escreva uma nota...',
    'notes.save': 'Salvar Nota',
    
    'history.title': 'Histórico',
    'history.empty.title': 'Sem Conversas Ainda',
    'history.empty.description': 'Seu histórico de conversas aparecerá aqui',
    'history.new': 'Nova Conversa',
    'history.startHint': 'Inicie uma nova conversa para começar',
    
    'nav.chat': 'Chat',
    'nav.resources': 'Recursos',
    
    'common.loading': 'Carregando...',
    'common.error': 'Erro',
    'common.cancel': 'Cancelar',
    'common.confirm': 'Confirmar',
    'common.save': 'Salvar',
    'common.close': 'Fechar',
    
    'fallback.badge': 'Fallback em inglês',
    'fallback.translate': 'Traduzir',
    'fallback.translateAll': 'Traduzir Tudo',
    'fallback.translating': 'Traduzindo...',
    'translation.dialog.title': 'Traduzir Conteúdo?',
    'translation.dialog.titleBatch': 'Traduzir Todo o Conteúdo?',
    'translation.dialog.description': 'Este conteúdo está disponível apenas em inglês. Deseja usar IA para traduzi-lo?',
    'translation.dialog.descriptionBatch': 'itens estão disponíveis apenas em inglês. Deseja usar IA para traduzi-los todos?',
    'translation.dialog.keep': 'Manter em Inglês',
    'translation.dialog.translate': 'Traduzir',
    'translation.dialog.disclaimer': 'Traduções de IA podem não ser perfeitamente precisas. Use apenas como referência.',
    
    'language.title': 'Selecionar Idioma',
    'language.subtitle': 'Escolha seu idioma preferido para os recursos bíblicos',
    'language.search': 'Pesquisar idiomas...',
    'language.organization': 'Provedor de recursos',
    'language.continue': 'Continuar',
  },
  
  // French
  'fr': {
    'chat.placeholder': 'Posez une question sur un passage biblique...',
    'chat.send': 'Envoyer',
    'chat.loading': 'Réflexion...',
    'chat.welcome.title': 'Assistant de Traduction Biblique',
    'chat.welcome.subtitle': 'Posez une question sur un passage des Écritures pour commencer',
    'chat.welcome.hint': 'Essayez : "Romains 3" ou "Que signifie justification ?"',
    'chat.changeLanguage': 'Changer de langue',
    'chat.translateUi': 'Traduire l\'interface',
    
    'scripture.title': 'Écriture',
    'scripture.empty.title': 'Passage Biblique',
    'scripture.empty.description': 'Commencez une conversation pour voir les Écritures pertinentes ici',
    'scripture.error.title': 'Impossible de charger les Écritures',
    'scripture.error.notFound': 'La référence biblique est introuvable. Veuillez vérifier le format.',
    'scripture.error.network': 'Erreur réseau. Veuillez vérifier votre connexion et réessayer.',
    'scripture.error.generic': 'Une erreur est survenue lors de la récupération des données bibliques.',
    'scripture.retry': 'Réessayer',
    'scripture.selectHint': 'Touchez un verset pour cibler les ressources',
    'scripture.clearFilter': 'Touchez à nouveau le verset pour effacer le filtre',
    'scripture.focused': 'Ciblé',
    
    'resources.title': 'Ressources',
    'resources.empty.title': 'Ressources de Traduction',
    'resources.empty.description': 'Les ressources apparaîtront ici lorsque vous explorerez les Écritures',
    'resources.notes': 'Notes de Traduction',
    'resources.questions': 'Questions d\'Étude',
    'resources.words': 'Termes Clés',
    'resources.academy': 'Articles de l\'Académie',
    'resources.showMore': 'Voir plus',
    'resources.showLess': 'Voir moins',
    'resources.filtered': 'Filtré sur',
    'resources.clearFilter': 'Effacer le filtre',
    
    'notes.title': 'Mes Notes',
    'notes.empty.title': 'Notes Personnelles',
    'notes.empty.description': 'Sélectionnez du texte des Écritures ou des ressources pour ajouter des notes',
    'notes.add': 'Ajouter une note',
    'notes.delete': 'Supprimer',
    'notes.placeholder': 'Écrivez une note...',
    'notes.save': 'Enregistrer la Note',
    
    'history.title': 'Historique',
    'history.empty.title': 'Pas encore de conversations',
    'history.empty.description': 'Votre historique de conversations apparaîtra ici',
    'history.new': 'Nouvelle Conversation',
    'history.startHint': 'Commencez une nouvelle conversation',
    
    'nav.chat': 'Chat',
    'nav.resources': 'Ressources',
    
    'common.loading': 'Chargement...',
    'common.error': 'Erreur',
    'common.cancel': 'Annuler',
    'common.confirm': 'Confirmer',
    'common.save': 'Enregistrer',
    'common.close': 'Fermer',
    
    'fallback.badge': 'Secours en anglais',
    'fallback.translate': 'Traduire',
    'fallback.translateAll': 'Tout Traduire',
    'fallback.translating': 'Traduction...',
    'translation.dialog.title': 'Traduire le Contenu ?',
    'translation.dialog.titleBatch': 'Traduire Tout le Contenu ?',
    'translation.dialog.description': 'Ce contenu n\'est disponible qu\'en anglais. Voulez-vous utiliser l\'IA pour le traduire ?',
    'translation.dialog.descriptionBatch': 'éléments ne sont disponibles qu\'en anglais. Voulez-vous utiliser l\'IA pour les traduire tous ?',
    'translation.dialog.keep': 'Garder en Anglais',
    'translation.dialog.translate': 'Traduire',
    'translation.dialog.disclaimer': 'Les traductions IA peuvent ne pas être parfaitement précises. À utiliser uniquement comme référence.',
    
    'language.title': 'Sélectionner la Langue',
    'language.subtitle': 'Choisissez votre langue préférée pour les ressources bibliques',
    'language.search': 'Rechercher des langues...',
    'language.organization': 'Fournisseur de ressources',
    'language.continue': 'Continuer',
  },
  
  // Hindi
  'hi': {
    'chat.placeholder': 'किसी भी पवित्रशास्त्र के अंश के बारे में पूछें...',
    'chat.send': 'भेजें',
    'chat.loading': 'सोच रहा हूँ...',
    'chat.welcome.title': 'बाइबिल अनुवाद सहायक',
    'chat.welcome.subtitle': 'शुरू करने के लिए किसी भी पवित्रशास्त्र के अंश के बारे में पूछें',
    'chat.welcome.hint': 'कोशिश करें: "रोमियों 3" या "धर्मीकरण का क्या अर्थ है?"',
    'chat.changeLanguage': 'भाषा बदलें',
    'chat.translateUi': 'इंटरफ़ेस अनुवाद करें',
    
    'scripture.title': 'पवित्रशास्त्र',
    'scripture.empty.title': 'बाइबिल अंश',
    'scripture.empty.description': 'यहाँ प्रासंगिक पवित्रशास्त्र देखने के लिए बातचीत शुरू करें',
    'scripture.error.title': 'पवित्रशास्त्र लोड नहीं हो सका',
    'scripture.error.notFound': 'बाइबिल संदर्भ नहीं मिला। कृपया प्रारूप की जाँच करें।',
    'scripture.error.network': 'नेटवर्क त्रुटि। कृपया अपना कनेक्शन जाँचें और पुनः प्रयास करें।',
    'scripture.error.generic': 'पवित्रशास्त्र डेटा प्राप्त करते समय कुछ गलत हो गया।',
    'scripture.retry': 'पुनः प्रयास करें',
    'scripture.selectHint': 'संसाधनों पर ध्यान केंद्रित करने के लिए किसी आयत पर टैप करें',
    'scripture.clearFilter': 'फ़िल्टर साफ़ करने के लिए फिर से आयत पर टैप करें',
    'scripture.focused': 'केंद्रित',
    
    'resources.title': 'संसाधन',
    'resources.empty.title': 'अनुवाद संसाधन',
    'resources.empty.description': 'जब आप पवित्रशास्त्र का अन्वेषण करेंगे तो यहाँ संसाधन दिखाई देंगे',
    'resources.notes': 'अनुवाद नोट्स',
    'resources.questions': 'अध्ययन प्रश्न',
    'resources.words': 'मुख्य शब्द',
    'resources.academy': 'अकादमी लेख',
    'resources.showMore': 'और देखें',
    'resources.showLess': 'कम देखें',
    'resources.filtered': 'फ़िल्टर किया गया',
    'resources.clearFilter': 'फ़िल्टर साफ़ करें',
    
    'notes.title': 'मेरे नोट्स',
    'notes.empty.title': 'व्यक्तिगत नोट्स',
    'notes.empty.description': 'नोट्स जोड़ने के लिए पवित्रशास्त्र या संसाधनों से टेक्स्ट चुनें',
    'notes.add': 'नोट जोड़ें',
    'notes.delete': 'हटाएं',
    'notes.placeholder': 'एक नोट लिखें...',
    'notes.save': 'नोट सहेजें',
    
    'history.title': 'इतिहास',
    'history.empty.title': 'अभी तक कोई बातचीत नहीं',
    'history.empty.description': 'आपका बातचीत इतिहास यहाँ दिखाई देगा',
    'history.new': 'नई बातचीत',
    'history.startHint': 'शुरू करने के लिए नई बातचीत शुरू करें',
    
    'nav.chat': 'चैट',
    'nav.resources': 'संसाधन',
    
    'common.loading': 'लोड हो रहा है...',
    'common.error': 'त्रुटि',
    'common.cancel': 'रद्द करें',
    'common.confirm': 'पुष्टि करें',
    'common.save': 'सहेजें',
    'common.close': 'बंद करें',
    
    'fallback.badge': 'अंग्रेजी फ़ॉलबैक',
    'fallback.translate': 'अनुवाद करें',
    'fallback.translateAll': 'सभी का अनुवाद करें',
    'fallback.translating': 'अनुवाद हो रहा है...',
    'translation.dialog.title': 'सामग्री का अनुवाद करें?',
    'translation.dialog.titleBatch': 'सभी सामग्री का अनुवाद करें?',
    'translation.dialog.description': 'यह सामग्री केवल अंग्रेजी में उपलब्ध है। क्या आप इसका अनुवाद करने के लिए AI का उपयोग करना चाहते हैं?',
    'translation.dialog.descriptionBatch': 'आइटम केवल अंग्रेजी में उपलब्ध हैं। क्या आप सभी का अनुवाद करने के लिए AI का उपयोग करना चाहते हैं?',
    'translation.dialog.keep': 'अंग्रेजी में रखें',
    'translation.dialog.translate': 'अनुवाद करें',
    'translation.dialog.disclaimer': 'AI अनुवाद पूरी तरह से सटीक नहीं हो सकते। केवल संदर्भ के लिए उपयोग करें।',
    
    'language.title': 'भाषा चुनें',
    'language.subtitle': 'बाइबिल संसाधनों के लिए अपनी पसंदीदा भाषा चुनें',
    'language.search': 'भाषाएं खोजें...',
    'language.organization': 'संसाधन प्रदाता',
    'language.continue': 'जारी रखें',
  },
  
  // Indonesian
  'id': {
    'chat.placeholder': 'Tanyakan tentang bagian Alkitab mana pun...',
    'chat.send': 'Kirim',
    'chat.loading': 'Berpikir...',
    'chat.welcome.title': 'Asisten Penerjemahan Alkitab',
    'chat.welcome.subtitle': 'Tanyakan tentang bagian Kitab Suci mana pun untuk memulai',
    'chat.welcome.hint': 'Coba: "Roma 3" atau "Apa arti pembenaran?"',
    'chat.changeLanguage': 'Ubah bahasa',
    'chat.translateUi': 'Terjemahkan antarmuka',
    
    'scripture.title': 'Kitab Suci',
    'scripture.empty.title': 'Bagian Alkitab',
    'scripture.empty.description': 'Mulai percakapan untuk melihat Kitab Suci yang relevan di sini',
    'scripture.error.title': 'Tidak Dapat Memuat Kitab Suci',
    'scripture.error.notFound': 'Referensi Alkitab tidak dapat ditemukan. Silakan periksa formatnya.',
    'scripture.error.network': 'Kesalahan jaringan. Silakan periksa koneksi Anda dan coba lagi.',
    'scripture.error.generic': 'Terjadi kesalahan saat mengambil data Kitab Suci.',
    'scripture.retry': 'Coba Lagi',
    'scripture.selectHint': 'Ketuk ayat untuk memfokuskan sumber daya',
    'scripture.clearFilter': 'Ketuk ayat lagi untuk menghapus filter',
    'scripture.focused': 'Terfokus',
    
    'resources.title': 'Sumber Daya',
    'resources.empty.title': 'Sumber Daya Terjemahan',
    'resources.empty.description': 'Sumber daya akan muncul di sini saat Anda menjelajahi Kitab Suci',
    'resources.notes': 'Catatan Terjemahan',
    'resources.questions': 'Pertanyaan Studi',
    'resources.words': 'Istilah Kunci',
    'resources.academy': 'Artikel Akademi',
    'resources.showMore': 'Lihat lebih banyak',
    'resources.showLess': 'Lihat lebih sedikit',
    'resources.filtered': 'Difilter ke',
    'resources.clearFilter': 'Hapus filter',
    
    'notes.title': 'Catatan Saya',
    'notes.empty.title': 'Catatan Pribadi',
    'notes.empty.description': 'Pilih teks dari Kitab Suci atau sumber daya untuk menambahkan catatan',
    'notes.add': 'Tambah catatan',
    'notes.delete': 'Hapus',
    'notes.placeholder': 'Tulis catatan...',
    'notes.save': 'Simpan Catatan',
    
    'history.title': 'Riwayat',
    'history.empty.title': 'Belum Ada Percakapan',
    'history.empty.description': 'Riwayat percakapan Anda akan muncul di sini',
    'history.new': 'Percakapan Baru',
    'history.startHint': 'Mulai percakapan baru untuk memulai',
    
    'nav.chat': 'Obrolan',
    'nav.resources': 'Sumber Daya',
    
    'common.loading': 'Memuat...',
    'common.error': 'Kesalahan',
    'common.cancel': 'Batal',
    'common.confirm': 'Konfirmasi',
    'common.save': 'Simpan',
    'common.close': 'Tutup',
    
    'fallback.badge': 'Fallback bahasa Inggris',
    'fallback.translate': 'Terjemahkan',
    'fallback.translateAll': 'Terjemahkan Semua',
    'fallback.translating': 'Menerjemahkan...',
    'translation.dialog.title': 'Terjemahkan Konten?',
    'translation.dialog.titleBatch': 'Terjemahkan Semua Konten?',
    'translation.dialog.description': 'Konten ini hanya tersedia dalam bahasa Inggris. Apakah Anda ingin menggunakan AI untuk menerjemahkannya?',
    'translation.dialog.descriptionBatch': 'item hanya tersedia dalam bahasa Inggris. Apakah Anda ingin menggunakan AI untuk menerjemahkan semuanya?',
    'translation.dialog.keep': 'Tetap dalam Bahasa Inggris',
    'translation.dialog.translate': 'Terjemahkan',
    'translation.dialog.disclaimer': 'Terjemahan AI mungkin tidak sepenuhnya akurat. Gunakan hanya sebagai referensi.',
    
    'language.title': 'Pilih Bahasa',
    'language.subtitle': 'Pilih bahasa pilihan Anda untuk sumber daya Alkitab',
    'language.search': 'Cari bahasa...',
    'language.organization': 'Penyedia sumber daya',
    'language.continue': 'Lanjutkan',
  },
  
  // Arabic
  'ar': {
    'chat.placeholder': 'اسأل عن أي مقطع من الكتاب المقدس...',
    'chat.send': 'إرسال',
    'chat.loading': 'جارٍ التفكير...',
    'chat.welcome.title': 'مساعد ترجمة الكتاب المقدس',
    'chat.welcome.subtitle': 'اسأل عن أي مقطع من الكتاب المقدس للبدء',
    'chat.welcome.hint': 'جرّب: "رومية 3" أو "ما معنى التبرير؟"',
    'chat.changeLanguage': 'تغيير اللغة',
    'chat.translateUi': 'ترجمة الواجهة',
    
    'scripture.title': 'الكتاب المقدس',
    'scripture.empty.title': 'مقطع كتابي',
    'scripture.empty.description': 'ابدأ محادثة لرؤية النص الكتابي المناسب هنا',
    'scripture.error.title': 'تعذر تحميل الكتاب المقدس',
    'scripture.error.notFound': 'لم يتم العثور على المرجع الكتابي. يرجى التحقق من التنسيق.',
    'scripture.error.network': 'خطأ في الشبكة. يرجى التحقق من اتصالك والمحاولة مرة أخرى.',
    'scripture.error.generic': 'حدث خطأ أثناء جلب بيانات الكتاب المقدس.',
    'scripture.retry': 'حاول مرة أخرى',
    'scripture.selectHint': 'انقر على آية للتركيز على الموارد',
    'scripture.clearFilter': 'انقر على الآية مرة أخرى لإزالة الفلتر',
    'scripture.focused': 'مُركَّز',
    
    'resources.title': 'الموارد',
    'resources.empty.title': 'موارد الترجمة',
    'resources.empty.description': 'ستظهر الموارد هنا عند استكشاف الكتاب المقدس',
    'resources.notes': 'ملاحظات الترجمة',
    'resources.questions': 'أسئلة الدراسة',
    'resources.words': 'المصطلحات الرئيسية',
    'resources.academy': 'مقالات الأكاديمية',
    'resources.showMore': 'عرض المزيد',
    'resources.showLess': 'عرض أقل',
    'resources.filtered': 'تمت التصفية إلى',
    'resources.clearFilter': 'إزالة الفلتر',
    
    'notes.title': 'ملاحظاتي',
    'notes.empty.title': 'ملاحظات شخصية',
    'notes.empty.description': 'حدد نصًا من الكتاب المقدس أو الموارد لإضافة ملاحظات',
    'notes.add': 'إضافة ملاحظة',
    'notes.delete': 'حذف',
    'notes.placeholder': 'اكتب ملاحظة...',
    'notes.save': 'حفظ الملاحظة',
    
    'history.title': 'السجل',
    'history.empty.title': 'لا توجد محادثات بعد',
    'history.empty.description': 'سيظهر سجل محادثاتك هنا',
    'history.new': 'محادثة جديدة',
    'history.startHint': 'ابدأ محادثة جديدة للبدء',
    
    'nav.chat': 'الدردشة',
    'nav.resources': 'الموارد',
    
    'common.loading': 'جارٍ التحميل...',
    'common.error': 'خطأ',
    'common.cancel': 'إلغاء',
    'common.confirm': 'تأكيد',
    'common.save': 'حفظ',
    'common.close': 'إغلاق',
    
    'fallback.badge': 'احتياطي باللغة الإنجليزية',
    'fallback.translate': 'ترجمة',
    'fallback.translateAll': 'ترجمة الكل',
    'fallback.translating': 'جارٍ الترجمة...',
    'translation.dialog.title': 'ترجمة المحتوى؟',
    'translation.dialog.titleBatch': 'ترجمة كل المحتوى؟',
    'translation.dialog.description': 'هذا المحتوى متاح فقط باللغة الإنجليزية. هل تريد استخدام الذكاء الاصطناعي لترجمته؟',
    'translation.dialog.descriptionBatch': 'العناصر متاحة فقط باللغة الإنجليزية. هل تريد استخدام الذكاء الاصطناعي لترجمتها جميعًا؟',
    'translation.dialog.keep': 'الإبقاء بالإنجليزية',
    'translation.dialog.translate': 'ترجمة',
    'translation.dialog.disclaimer': 'قد لا تكون ترجمات الذكاء الاصطناعي دقيقة تمامًا. استخدمها كمرجع فقط.',
    
    'language.title': 'اختر اللغة',
    'language.subtitle': 'اختر لغتك المفضلة لموارد الكتاب المقدس',
    'language.search': 'البحث عن لغات...',
    'language.organization': 'مزود الموارد',
    'language.continue': 'متابعة',
  },
};

// Language code mapping for matching user's selected language to translations
const languageMapping: Record<string, string> = {
  'es-419': 'es-419',
  'es': 'es-419',
  'pt-br': 'pt-br', 
  'pt': 'pt-br',
  'fr': 'fr',
  'hi': 'hi',
  'id': 'id',
  'ar': 'ar',
  'en': 'en',
};

export function getTranslations(languageCode: string): TranslationStrings {
  // Try exact match first
  if (translations[languageCode]) {
    return translations[languageCode];
  }
  
  // Try mapped language
  const mappedCode = languageMapping[languageCode.toLowerCase()];
  if (mappedCode && translations[mappedCode]) {
    return translations[mappedCode];
  }
  
  // Try base language (e.g., 'es' from 'es-419')
  const baseCode = languageCode.split('-')[0].toLowerCase();
  const mappedBase = languageMapping[baseCode];
  if (mappedBase && translations[mappedBase]) {
    return translations[mappedBase];
  }
  
  // Return English as default
  return translations['en'];
}

export function hasStaticTranslation(languageCode: string): boolean {
  const code = languageCode.toLowerCase();
  return !!translations[code] || !!languageMapping[code] || !!languageMapping[code.split('-')[0]];
}
