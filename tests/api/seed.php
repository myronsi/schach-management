<?php
$pdo = new PDO('mysql:host=smdb;dbname=club', 'root', 'testpw');
$h = fn($p) => password_hash($p, PASSWORD_DEFAULT);
$st = $pdo->prepare('INSERT INTO users (username,password,status,password_status) VALUES (?,?,?,?)');
foreach ([['chair','chairpass1','chairman','changed'],['admin1','adminpass1','admin','changed'],['admin2','adminpass2','admin','changed'],['member','memberpass','user','changed'],['blocked','blockedpass','blocked','changed'],['newbie','temppass1','user','unchanged']] as $u) {
  $st->execute([$u[0], $h($u[1]), $u[2], $u[3]]);
}
echo "seeded\n";
