import 'package:flutter/material.dart';

import 'app_widgets.dart';

class SafetyNotice extends StatelessWidget {
  const SafetyNotice({super.key});
  @override
  Widget build(BuildContext context) => AppCard(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Privacy and safety',
            style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        const Text(
            'Student-submitted images are stored in private storage for attendance review and are subject to the configured retention period. Person detection provides scene evidence only; it does not identify anyone and no biometric templates are created. A professor reviews uncertain evidence. Notifications stay in this app.')
      ]));
}
