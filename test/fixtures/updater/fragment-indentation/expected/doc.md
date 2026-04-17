## Test: code fragment should be unindented

<?code-excerpt "indented_frag.dart" region="single-code-block"?>
```dart
// Fragment is indented by 4 spaces
var x = 1;
return x;
```

## Test: discontiguous region should still be normalized

<?code-excerpt "indented_frag.dart" region="code-blocks"?>
```dart
    // Fragment is indented by 4 spaces
    var x = 1;
// ···
       return x;
```
