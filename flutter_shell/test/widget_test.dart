import 'package:flutter_test/flutter_test.dart';
import 'package:meal_room_shell/main.dart';

void main() {
  test('default Web app URL points to the CloudFront entry document', () {
    expect(
      resolveWebAppUrl(),
      'https://dqtgmho40xu09.cloudfront.net/index.html',
    );
  });
}
